import { useState } from 'react'
import { App, Button, Collapse, Space, Tag, Typography } from 'antd'
import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import { AiChartsPanel, chartsToPlainText, type AiChartSpec } from '@/components/AiChartsPanel'
import { BuyScorePanel, parseBuyScores } from '@/components/PeerComparePanel'

export interface AiChatBubbleMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  streaming?: boolean
  charts?: AiChartSpec[]
}

function extractVerdict(content: string): '偏多' | '中性' | '偏空' | null {
  const m = content.match(/判断[：:]\s*\*?\*?(偏多|中性|偏空)/)
  if (m) return m[1] as '偏多' | '中性' | '偏空'
  if (/综合判断[为是]?[：:]?\s*偏多|判断为偏多/.test(content)) return '偏多'
  if (/综合判断[为是]?[：:]?\s*偏空|判断为偏空/.test(content)) return '偏空'
  if (/综合判断[为是]?[：:]?\s*中性|判断为中性/.test(content)) return '中性'
  return null
}

function verdictColor(v: string) {
  if (v === '偏多') return 'red'
  if (v === '偏空') return 'green'
  return 'default'
}

function stripMarkdownLight(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^##\s+/gm, '')
    .replace(/^[-*]\s+/gm, '· ')
    .trim()
}

export function buildAssistantCopyText(m: AiChatBubbleMessage): string {
  const parts: string[] = []
  const verdict = extractVerdict(m.content)
  if (verdict) parts.push(`综合判断：${verdict}`)
  const scores = parseBuyScores(m.content)
  if (scores.length) {
    parts.push(
      '【买入推荐指数】\n' +
        scores
          .map((s) => `${s.code} ${s.name}：${s.score}${s.reason ? `｜${s.reason}` : ''}`)
          .join('\n'),
    )
  }
  if (m.charts?.length) {
    const chartText = chartsToPlainText(m.charts)
    if (chartText) parts.push(chartText)
  }
  if (m.content.trim()) parts.push(stripMarkdownLight(m.content))
  return parts.join('\n\n')
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

function renderAssistantText(content: string) {
  const lines = content.split('\n')
  return lines.map((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={idx} style={{ height: 8 }} />
    if (trimmed.startsWith('## ')) {
      return (
        <Typography.Title key={idx} level={5} style={{ margin: '10px 0 6px', fontSize: 14 }}>
          {trimmed.replace(/^##\s+/, '')}
        </Typography.Title>
      )
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={idx} style={{ paddingLeft: 4, marginBottom: 4 }}>
          · {trimmed.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
        </div>
      )
    }
    return (
      <div key={idx} style={{ marginBottom: 4 }}>
        {trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}
      </div>
    )
  })
}

export function AiChatBubble({
  message: m,
  wide,
}: {
  message: AiChatBubbleMessage
  wide?: boolean
}) {
  const { message } = App.useApp()
  const [copied, setCopied] = useState(false)
  const isUser = m.role === 'user'
  const verdict = !isUser && !m.streaming ? extractVerdict(m.content) : null
  const buyScores = !isUser && !m.streaming ? parseBuyScores(m.content) : []
  const canCopy = !isUser && !m.streaming && Boolean(m.content.trim() || m.charts?.length)

  const handleCopy = async () => {
    const text = buildAssistantCopyText(m)
    if (!text.trim()) {
      message.warning('暂无可复制内容')
      return
    }
    try {
      await writeClipboard(text)
      setCopied(true)
      message.success('已复制文字与图表数据')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      message.error('复制失败，请手动选择文字')
    }
  }

  return (
    <div
      style={{
        marginBottom: 14,
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: wide ? '96%' : '92%',
          width: isUser ? undefined : wide ? '96%' : '92%',
          background: isUser ? '#1677ff' : '#f7f8fa',
          color: isUser ? '#fff' : 'inherit',
          borderRadius: 12,
          padding: isUser ? '8px 12px' : '10px 12px',
          wordBreak: 'break-word',
          fontSize: 13,
          lineHeight: 1.55,
          border: isUser ? undefined : '1px solid #f0f0f0',
          position: 'relative',
        }}
      >
        {!isUser && (m.reasoning || m.streaming) ? (
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

        {!isUser && m.charts && m.charts.length > 0 ? <AiChartsPanel charts={m.charts} /> : null}

        {!isUser && buyScores.length > 0 ? <BuyScorePanel items={buyScores} /> : null}

        {!isUser && (verdict || canCopy) ? (
          <div
            style={{
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Space size={6}>
              {verdict ? (
                <Tag color={verdictColor(verdict)} style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}>
                  综合判断：{verdict}
                </Tag>
              ) : null}
            </Space>
            {canCopy ? (
              <Button
                size="small"
                type="text"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={() => void handleCopy()}
              >
                {copied ? '已复制' : '复制'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
        ) : m.content ? (
          <div>{renderAssistantText(m.content)}</div>
        ) : m.streaming ? (
          <Typography.Text type="secondary">…</Typography.Text>
        ) : null}

        {!isUser && canCopy && !verdict ? (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button
              size="small"
              type="text"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={() => void handleCopy()}
            >
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
