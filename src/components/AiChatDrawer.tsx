import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Drawer, Input, Space, Spin, Tag, Typography, App } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { streamStockAIChat } from '@/api/endpoints/aiChat'
import { AiChatBubble, type AiChatBubbleMessage } from '@/components/AiChatBubble'
import type { AiChartSpec } from '@/components/AiChartsPanel'
import { PeerSuggestPanel, type PeerItem } from '@/components/PeerComparePanel'

export interface AiChatDrawerProps {
  open: boolean
  code: string
  stockName?: string
  onClose: () => void
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AiChatDrawer({ open, code, stockName, onClose }: AiChatDrawerProps) {
  const { message } = App.useApp()
  const [messages, setMessages] = useState<AiChatBubbleMessage[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [statusText, setStatusText] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleName, setTitleName] = useState(stockName || code)
  const [industry, setIndustry] = useState('')
  const [peers, setPeers] = useState<PeerItem[]>([])
  const [showPeers, setShowPeers] = useState(false)
  const [compared, setCompared] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bootstrappedRef = useRef(false)
  const pendingChartsRef = useRef<AiChartSpec[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText, busy, showPeers])

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      bootstrappedRef.current = false
      pendingChartsRef.current = []
      setMessages([])
      setSystemPrompt('')
      setModel('')
      setStatusText('')
      setInput('')
      setBusy(false)
      setIndustry('')
      setPeers([])
      setShowPeers(false)
      setCompared(false)
      return
    }
    if (!code || bootstrappedRef.current) return
    bootstrappedRef.current = true
    void runBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code])

  async function runBootstrap() {
    setBusy(true)
    setShowPeers(false)
    setCompared(false)
    setStatusText('准备中…')
    const ac = new AbortController()
    abortRef.current = ac
    let assistantId = ''
    pendingChartsRef.current = []
    try {
      await streamStockAIChat(
        code,
        {
          bootstrap: true,
          lookback_days: 60,
          include_chips: true,
          include_finance: true,
          include_news: true,
          include_capital: true,
          news_days: 30,
          news_limit: 8,
          capital_days: 20,
        },
        (ev) => {
          if (ev.type === 'status') {
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'peers') {
            setIndustry(ev.industry || '')
            setPeers(ev.items || [])
            return
          }
          if (ev.type === 'charts') {
            pendingChartsRef.current = ev.items || []
            if (assistantId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, charts: pendingChartsRef.current } : m,
                ),
              )
            }
            return
          }
          if (ev.type === 'meta') {
            setSystemPrompt(ev.system)
            setModel(ev.model)
            setTitleName(ev.name || stockName || code)
            if (ev.industry) setIndustry(ev.industry)
            if (ev.peers?.length) setPeers(ev.peers)
            if (ev.charts?.length) pendingChartsRef.current = ev.charts
            const userMessage = ev.user_message || ''
            setMessages([
              { id: uid(), role: 'user', content: userMessage },
              {
                id: (assistantId = uid()),
                role: 'assistant',
                content: '',
                reasoning: '',
                streaming: true,
                charts: pendingChartsRef.current,
              },
            ])
            setStatusText('模型思考中…')
            return
          }
          if (ev.type === 'reasoning') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, reasoning: (m.reasoning || '') + ev.text }
                  : m,
              ),
            )
            setStatusText('正在思考…')
            return
          }
          if (ev.type === 'content') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + ev.text } : m,
              ),
            )
            setStatusText('正在回复…')
            return
          }
          if (ev.type === 'error') {
            message.error(ev.message)
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'done') {
            if (ev.model) setModel(ev.model)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
            )
            setStatusText('')
            setShowPeers(true)
          }
        },
        ac.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
      setStatusText(msg)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  async function runPeerCompare() {
    if (busy || !peers.length) return
    setBusy(true)
    setCompared(true)
    setStatusText('正在对比同行业公司…')
    pendingChartsRef.current = []
    const assistantId = uid()
    const userLine = `请对比 ${titleName}（${code}）与同行业相似公司，并给出买入推荐指数`
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', content: userLine },
      { id: assistantId, role: 'assistant', content: '', reasoning: '', streaming: true },
    ])

    const ac = new AbortController()
    abortRef.current = ac
    try {
      await streamStockAIChat(
        code,
        { compare_peers: true, peer_limit: 4 },
        (ev) => {
          if (ev.type === 'status') {
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'meta') {
            // 对比会话使用独立 system，后续追问可切到对比上下文
            setSystemPrompt(ev.system)
            setModel(ev.model)
            if (ev.user_message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.role === 'user' && m.content === userLine
                    ? { ...m, content: ev.user_message || userLine }
                    : m,
                ),
              )
            }
            return
          }
          if (ev.type === 'charts') {
            pendingChartsRef.current = ev.items || []
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, charts: pendingChartsRef.current } : m,
              ),
            )
            return
          }
          if (ev.type === 'reasoning') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, reasoning: (m.reasoning || '') + ev.text }
                  : m,
              ),
            )
            setStatusText('正在思考对比结论…')
            return
          }
          if (ev.type === 'content') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + ev.text } : m,
              ),
            )
            setStatusText('正在生成买入推荐指数…')
            return
          }
          if (ev.type === 'error') {
            message.error(ev.message)
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'done') {
            if (ev.model) setModel(ev.model)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
            )
            setStatusText('')
          }
        },
        ac.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
      setStatusText(msg)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  async function sendFollowUp(text: string) {
    const q = text.trim()
    if (!q || busy || !systemPrompt) return
    setInput('')
    setBusy(true)
    setStatusText('正在生成回复…')

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    history.push({ role: 'user', content: q })

    const assistantId = uid()
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', content: q },
      { id: assistantId, role: 'assistant', content: '', reasoning: '', streaming: true },
    ])

    const ac = new AbortController()
    abortRef.current = ac
    try {
      await streamStockAIChat(
        code,
        {
          bootstrap: false,
          system: systemPrompt,
          messages: history,
        },
        (ev) => {
          if (ev.type === 'status') {
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'reasoning') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, reasoning: (m.reasoning || '') + ev.text }
                  : m,
              ),
            )
            setStatusText('正在思考…')
            return
          }
          if (ev.type === 'content') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + ev.text } : m,
              ),
            )
            setStatusText('正在回复…')
            return
          }
          if (ev.type === 'error') {
            message.error(ev.message)
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'done') {
            if (ev.model) setModel(ev.model)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
            )
            setStatusText('')
          }
        },
        ac.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
      setStatusText(msg)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const drawerWidth =
    typeof window !== 'undefined' ? Math.min(860, Math.max(560, window.innerWidth - 48)) : 860

  return (
    <Drawer
      title={
        <Space wrap>
          <span>AI 分析</span>
          <Tag>{titleName}</Tag>
          {industry ? <Tag color="processing">{industry}</Tag> : null}
          {model ? <Tag color="blue">{model}</Tag> : null}
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={open}
      onClose={() => {
        abortRef.current?.abort()
        onClose()
      }}
      destroyOnClose
      styles={{ body: { display: 'flex', flexDirection: 'column', padding: 12, gap: 8 } }}
    >
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        {messages.length === 0 && busy && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
            <div style={{ marginTop: 12 }}>{statusText || '准备中…'}</div>
          </div>
        )}
        {messages.map((m) => (
          <AiChatBubble key={m.id} message={m} wide />
        ))}

        {showPeers && peers.length > 0 && !compared ? (
          <PeerSuggestPanel
            industry={industry}
            peers={peers}
            focusName={titleName}
            disabled={busy}
            onCompare={() => void runPeerCompare()}
          />
        ) : null}

        {showPeers && peers.length === 0 && !busy ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="暂无同行业相似公司可推荐（行业字段为空或样本不足）"
          />
        ) : null}

        {busy && statusText && messages.length > 0 ? (
          <Alert type="info" showIcon message={statusText} style={{ marginBottom: 8 }} />
        ) : null}
        <div ref={bottomRef} />
      </div>

      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? '生成中，请稍候…' : '继续追问，或点击上方「对比并给买入指数」'}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={busy || !systemPrompt}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              void sendFollowUp(input)
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          disabled={busy || !input.trim() || !systemPrompt}
          onClick={() => void sendFollowUp(input)}
          style={{ height: 'auto' }}
        >
          发送
        </Button>
      </Space.Compact>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        相似公司来自同行业；买入推荐指数为相对排序参考，不构成投资建议。
      </Typography.Text>
    </Drawer>
  )
}
