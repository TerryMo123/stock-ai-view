import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  App,
} from 'antd'
import { ClearOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import { streamGeneralAIChat } from '@/api/endpoints/aiChat'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  streaming?: boolean
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const FALLBACK_SUGGESTIONS = [
  '今天怎么看大盘和北向资金？',
  '创业板近期偏强还是偏弱？需要关注什么？',
  '半导体板块现在主要矛盾是什么？',
  '帮我分析一下 600519 的资金面和股东户数变化',
]

export function AiChatPage() {
  const { message } = App.useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS)
  const [statusText, setStatusText] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText, busy])

  useEffect(() => {
    void bootstrap()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function bootstrap() {
    setBusy(true)
    setReady(false)
    setStatusText('正在准备市场快照…')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await streamGeneralAIChat(
        { bootstrap: true },
        (ev) => {
          if (ev.type === 'status') {
            setStatusText(ev.message)
            return
          }
          if (ev.type === 'meta') {
            setSystemPrompt(ev.system)
            setModel(ev.model)
            if (ev.suggestions?.length) setSuggestions(ev.suggestions)
            setStatusText('')
            setReady(true)
            return
          }
          if (ev.type === 'error') {
            message.error(ev.message)
            setStatusText(ev.message)
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

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy || !systemPrompt) return
    setInput('')
    setBusy(true)
    setStatusText('正在生成…')

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
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
      await streamGeneralAIChat(
        {
          bootstrap: false,
          system: systemPrompt,
          messages: history,
          enrich_stocks: true,
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

  function resetChat() {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setStatusText('')
    void bootstrap()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 480 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <RobotOutlined /> AI 分析
        </Typography.Title>
        {model ? <Tag color="blue">{model}</Tag> : null}
        <Tag color={ready ? 'green' : 'default'}>{ready ? '已就绪' : '准备中'}</Tag>
        <Button size="small" icon={<ClearOutlined />} onClick={resetChat} disabled={busy}>
          新对话
        </Button>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        可问大盘、创业板、板块或个股（消息里写 6 位代码会自动补事实）。流式展示思考与回复。
      </Typography.Paragraph>

      <Card
        size="small"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12 } }}
      >
        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {!ready && busy && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
              <div style={{ marginTop: 12 }}>{statusText || '准备中…'}</div>
            </div>
          )}

          {ready && messages.length === 0 && (
            <div style={{ padding: '12px 4px' }}>
              <Typography.Text type="secondary">试试这样问：</Typography.Text>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map((s) => (
                  <Button key={s} onClick={() => void send(s)} disabled={busy}>
                    {s}
                  </Button>
                ))}
              </div>
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
                  maxWidth: '88%',
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

        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ready ? '输入问题，Shift+Enter 换行' : '市场快照准备中…'}
            autoSize={{ minRows: 2, maxRows: 5 }}
            disabled={!ready || busy}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!ready || busy || !input.trim()}
            onClick={() => void send(input)}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>
    </div>
  )
}
