import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Collapse,
  Drawer,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  App,
} from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { streamStockAIChat } from '@/api/endpoints/aiChat'

export interface AiChatDrawerProps {
  open: boolean
  code: string
  stockName?: string
  onClose: () => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  streaming?: boolean
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AiChatDrawer({ open, code, stockName, onClose }: AiChatDrawerProps) {
  const { message } = App.useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [statusText, setStatusText] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleName, setTitleName] = useState(stockName || code)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText, busy])

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      bootstrappedRef.current = false
      setMessages([])
      setSystemPrompt('')
      setModel('')
      setStatusText('')
      setInput('')
      setBusy(false)
      return
    }
    if (!code || bootstrappedRef.current) return
    bootstrappedRef.current = true
    void runBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code])

  async function runBootstrap() {
    setBusy(true)
    setStatusText('准备中…')
    const ac = new AbortController()
    abortRef.current = ac
    let assistantId = ''
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
          if (ev.type === 'meta') {
            setSystemPrompt(ev.system)
            setModel(ev.model)
            setTitleName(ev.name || stockName || code)
            const userMessage = ev.user_message || ''
            setMessages([
              { id: uid(), role: 'user', content: userMessage },
              {
                id: (assistantId = uid()),
                role: 'assistant',
                content: '',
                reasoning: '',
                streaming: true,
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

    const userId = uid()
    const assistantId = uid()
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: q },
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

  return (
    <Drawer
      title={
        <Space wrap>
          <span>AI 分析</span>
          <Tag>{titleName}</Tag>
          {model ? <Tag color="blue">{model}</Tag> : null}
        </Space>
      }
      placement="right"
      width={Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 24 : 520)}
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
          <div
            key={m.id}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '92%',
                background: m.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: m.role === 'user' ? '#fff' : 'inherit',
                borderRadius: 10,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {m.role === 'assistant' && (m.reasoning || m.streaming) ? (
                <Collapse
                  size="small"
                  style={{ marginBottom: 8, background: '#fff' }}
                  defaultActiveKey={m.streaming && !m.content ? ['think'] : []}
                  items={[
                    {
                      key: 'think',
                      label: m.streaming && !m.content ? '思考中…' : '思考过程',
                      children: (
                        <Typography.Paragraph
                          type="secondary"
                          style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}
                        >
                          {m.reasoning || '…'}
                        </Typography.Paragraph>
                      ),
                    },
                  ]}
                />
              ) : null}
              {m.content || (m.streaming ? '…' : '')}
            </div>
          </div>
        ))}
        {busy && statusText && messages.length > 0 ? (
          <Alert type="info" showIcon message={statusText} style={{ marginBottom: 8 }} />
        ) : null}
        <div ref={bottomRef} />
      </div>

      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? '生成中，请稍候…' : '继续追问，例如：股东户数上升意味着什么？'}
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
        仅供研究学习，不构成投资建议。思考过程来自模型 reasoning，可折叠查看。
      </Typography.Text>
    </Drawer>
  )
}
