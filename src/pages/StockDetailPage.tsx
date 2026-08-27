import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Alert, Button, Segmented, Spin, Tag, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { fetchStockDaily, fetchStockDivergence } from '@/api/endpoints/stocks'
import type { ChartTimeframe } from '@/api/types'
import { AiChatDrawer } from '@/components/AiChatDrawer'
import { StockKlineChart } from '@/components/charts/StockKlineChart'
import { barsByTimeframe, indicatorsFromBars } from '@/utils/klineTimeframe'

const TF_OPTIONS: { label: string; value: ChartTimeframe }[] = [
  { label: '日K', value: 'daily' },
  { label: '周K', value: 'weekly' },
  { label: '月K', value: 'monthly' },
  { label: '年K', value: 'yearly' },
]

export function StockDetailPage() {
  const { code = '' } = useParams<{ code: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const stockName =
    (location.state as { name?: string } | null)?.name?.trim() ||
    searchParams.get('name')?.trim() ||
    undefined
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('daily')
  const [chatOpen, setChatOpen] = useState(false)

  const [dailyQ, divQ] = useQueries({
    queries: [
      {
        queryKey: ['stock', code, 'daily-all'],
        queryFn: () => fetchStockDaily(code, { tf: 'daily', limit: 5000 }),
        enabled: !!code,
      },
      {
        queryKey: ['stock', code, 'divergence'],
        queryFn: () => fetchStockDivergence(code, { days: 365, tf: 'daily,weekly,monthly,yearly' }),
        enabled: !!code,
      },
    ],
  })

  const loading = dailyQ.isLoading
  const error = dailyQ.error
  const bars = useMemo(
    () => barsByTimeframe(dailyQ.data?.items ?? [], timeframe),
    [dailyQ.data?.items, timeframe],
  )
  const indicators = useMemo(() => indicatorsFromBars(bars), [bars])

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {stockName ? `${stockName}（${code}）` : `${code} K线`}
        </Typography.Title>
        <Segmented
          options={TF_OPTIONS}
          value={timeframe}
          onChange={(v) => setTimeframe(v as ChartTimeframe)}
        />
        {timeframe !== 'daily' && (
          <Tag color="default" style={{ margin: 0 }}>
            由日K聚合
          </Tag>
        )}
        <Button
          type="primary"
          icon={<RobotOutlined />}
          disabled={!code}
          onClick={() => setChatOpen(true)}
        >
          AI 分析
        </Button>
      </div>

      {error && <Alert type="error" message="加载失败" description={String(error)} showIcon />}
      {loading && <Spin />}
      {!loading && dailyQ.data && (
        <StockKlineChart
          bars={bars}
          indicators={indicators}
          divergences={divQ.data?.items}
          timeframe={timeframe}
        />
      )}

      <AiChatDrawer
        open={chatOpen}
        code={code}
        stockName={stockName}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
