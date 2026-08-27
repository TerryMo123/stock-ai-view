import { Button, Card, Progress, Space, Tag, Typography } from 'antd'
import { SwapOutlined } from '@ant-design/icons'

export interface PeerItem {
  code: string
  name: string
  market?: string
  industry?: string
}

export interface BuyScoreItem {
  code: string
  name: string
  score: number
  reason?: string
}

/** 解析「- 600519 贵州茅台：78｜理由」类行 */
export function parseBuyScores(content: string): BuyScoreItem[] {
  const scores: BuyScoreItem[] = []
  const re =
    /[-*·]?\s*(\d{6})\s+([^\s：:|｜]+)\s*[：:]\s*(\d{1,3})\s*(?:[|｜]\s*(.+))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const score = Math.max(0, Math.min(100, Number(m[3])))
    scores.push({
      code: m[1],
      name: m[2].replace(/\*+/g, ''),
      score,
      reason: (m[4] || '').trim() || undefined,
    })
  }
  // 去重，保留首次
  const seen = new Set<string>()
  return scores.filter((s) => {
    if (seen.has(s.code)) return false
    seen.add(s.code)
    return true
  })
}

export function BuyScorePanel({ items }: { items: BuyScoreItem[] }) {
  if (!items.length) return null
  const ranked = [...items].sort((a, b) => b.score - a.score)
  return (
    <Card size="small" title="买入推荐指数（0-100，仅供研究）" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {ranked.map((it, idx) => (
          <div key={it.code}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>
                {idx === 0 ? <Tag color="red">优先关注</Tag> : null}
                {it.name}（{it.code}）
              </span>
              <Typography.Text strong>{it.score}</Typography.Text>
            </div>
            <Progress
              percent={it.score}
              showInfo={false}
              strokeColor={it.score >= 70 ? '#cf1322' : it.score >= 50 ? '#fa8c16' : '#8c8c8c'}
              size="small"
            />
            {it.reason ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {it.reason}
              </Typography.Text>
            ) : null}
          </div>
        ))}
      </Space>
    </Card>
  )
}

export function PeerSuggestPanel({
  industry,
  peers,
  focusName,
  disabled,
  onCompare,
}: {
  industry?: string
  peers: PeerItem[]
  focusName?: string
  disabled?: boolean
  onCompare: () => void
}) {
  if (!peers.length) return null
  return (
    <Card
      size="small"
      title={
        <span>
          相似业务公司
          {industry ? (
            <Tag style={{ marginLeft: 8 }} color="blue">
              {industry}
            </Tag>
          ) : null}
        </span>
      }
      style={{ marginBottom: 12, borderColor: '#91caff' }}
      extra={
        <Button
          type="primary"
          size="small"
          icon={<SwapOutlined />}
          disabled={disabled}
          onClick={onCompare}
        >
          对比并给买入指数
        </Button>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
        基于同行业推荐。可一键对比 {focusName || '当前标的'} 与下列公司的估值、涨跌、资金差异，并由 AI
        给出买入推荐指数。
      </Typography.Paragraph>
      <Space wrap size={[8, 8]}>
        {peers.map((p) => (
          <Tag key={p.code} style={{ padding: '4px 8px', fontSize: 13 }}>
            {p.name}（{p.code}）
          </Tag>
        ))}
      </Space>
    </Card>
  )
}
