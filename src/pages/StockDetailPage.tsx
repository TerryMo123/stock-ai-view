import { useMemo, useState } from 'react'
import { useMutation, useQueries } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Collapse,
  List,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  App,
} from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { fetchStockAIAnalysis } from '@/api/endpoints/aiAnalysis'
import { fetchStockDaily, fetchStockDivergence } from '@/api/endpoints/stocks'
import { ApiError } from '@/api/client'
import type { ChartTimeframe, StockAIAnalysisResponse } from '@/api/types'
import { StockKlineChart } from '@/components/charts/StockKlineChart'
import { barsByTimeframe, indicatorsFromBars } from '@/utils/klineTimeframe'

const TF_OPTIONS: { label: string; value: ChartTimeframe }[] = [
  { label: '日K', value: 'daily' },
  { label: '周K', value: 'weekly' },
  { label: '月K', value: 'monthly' },
  { label: '年K', value: 'yearly' },
]

function SectionCard({
  title,
  view,
  points,
}: {
  title: string
  view: string
  points: string[]
}) {
  return (
    <Card size="small" title={title} style={{ marginBottom: 12 }}>
      <Typography.Paragraph style={{ marginBottom: points.length ? 8 : 0 }}>{view}</Typography.Paragraph>
      {points.length > 0 && (
        <List
          size="small"
          dataSource={points}
          renderItem={(item) => <List.Item style={{ padding: '4px 0' }}>· {item}</List.Item>}
        />
      )}
    </Card>
  )
}

function AnalysisPanel({ data }: { data: StockAIAnalysisResponse }) {
  const a = data.analysis
  return (
    <div style={{ marginTop: 16 }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Tag color="blue">{data.model}</Tag>
          <Tag>数据截止 {data.data_as_of.last_trade_date || '—'}</Tag>
          {data.context_used.chips ? <Tag color="green">含筹码</Tag> : <Tag>无筹码</Tag>}
          {data.context_used.divergences ? <Tag color="purple">含背离</Tag> : null}
          {data.context_used.finance ? (
            <Tag color="cyan">含财务{data.data_as_of.finance_period ? ` ${data.data_as_of.finance_period}` : ''}</Tag>
          ) : (
            <Tag>无财务</Tag>
          )}
          {data.context_used.news ? (
            <Tag color="orange">
              {data.context_used.news_kind === 'reports' ? '含研报' : '含新闻'}
            </Tag>
          ) : (
            <Tag>无新闻</Tag>
          )}
          {data.context_used.capital ? (
            <Tag color="gold">
              含资金{data.data_as_of.capital_as_of ? ` ${data.data_as_of.capital_as_of}` : ''}
            </Tag>
          ) : (
            <Tag>无资金</Tag>
          )}
        </Space>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {a.summary}
        </Typography.Title>
        <Typography.Text type="secondary">{data.generated_at.replace('T', ' ')}</Typography.Text>
      </Card>

      <SectionCard title="技术面" view={a.technical.view} points={a.technical.points} />
      <SectionCard title="基本面" view={a.fundamental.view} points={a.fundamental.points} />
      {a.capital ? (
        <SectionCard title="资金面" view={a.capital.view} points={a.capital.points} />
      ) : null}
      <SectionCard title="消息面" view={a.news.view} points={a.news.points} />

      <Card size="small" title="情景" style={{ marginBottom: 12 }}>
        <p>
          <strong>偏多：</strong>
          {a.scenarios.bull}
        </p>
        <p>
          <strong>中性：</strong>
          {a.scenarios.base}
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>偏空：</strong>
          {a.scenarios.bear}
        </p>
      </Card>

      <Card size="small" title="风险" style={{ marginBottom: 12 }}>
        <List
          size="small"
          dataSource={a.risks}
          renderItem={(item) => <List.Item style={{ padding: '4px 0' }}>· {item}</List.Item>}
        />
      </Card>

      <Typography.Paragraph type="secondary">{a.disclaimer}</Typography.Paragraph>

      <Collapse
        items={[
          {
            key: 'facts',
            label: '数据依据（raw_facts）',
            children: (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {JSON.stringify(data.raw_facts, null, 2)}
              </pre>
            ),
          },
        ]}
      />
    </div>
  )
}

export function StockDetailPage() {
  const { message } = App.useApp()
  const { code = '' } = useParams<{ code: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const stockName =
    (location.state as { name?: string } | null)?.name?.trim() ||
    searchParams.get('name')?.trim() ||
    undefined
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('daily')
  const [analysis, setAnalysis] = useState<StockAIAnalysisResponse | null>(null)

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

  const aiMutation = useMutation({
    mutationFn: () =>
      fetchStockAIAnalysis(code, {
        lookback_days: 60,
        include_chips: true,
        include_finance: true,
        include_news: true,
        include_capital: true,
        news_days: 30,
        news_limit: 8,
        capital_days: 20,
        style: 'balanced',
      }),
    onSuccess: (data) => {
      setAnalysis(data)
      message.success('分析完成')
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '分析失败'
      message.error(msg)
    },
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
          loading={aiMutation.isPending}
          disabled={!code}
          onClick={() => {
            setAnalysis(null)
            aiMutation.mutate()
          }}
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

      {aiMutation.isPending && (
        <div style={{ marginTop: 16 }}>
          <Spin tip="正在结合行情 / 财务 / 新闻生成分析…" />
        </div>
      )}
      {analysis && <AnalysisPanel data={analysis} />}
    </div>
  )
}
