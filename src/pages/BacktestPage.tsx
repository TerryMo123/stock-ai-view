import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { fetchBacktestRun } from '@/api/endpoints/backtest'
import { ApiError } from '@/api/client'
import type { BacktestForwardStats, BacktestMatchRow, BacktestRunResponse } from '@/api/types'

const HORIZON_PRESETS = [
  { label: '5 / 10 / 20 日', value: '5,10,20' },
  { label: '5 / 10 / 30 日', value: '5,10,30' },
  { label: '10 / 20 / 60 日', value: '10,20,60' },
]

const FIELD_TIPS = {
  code: '6 位 A 股代码。回测使用该股票在库内的日 K 数据，需先通过 db-sync 同步行情。',
  window:
    '用最近 N 个交易日的 K 线形态作为「当前模板」，在更早的历史里用同样长度的窗口滑动比对相似度。N 越大越偏波段形态，越小越偏短期。',
  topK: '按相似度从高到低排序后，保留最相似的前 K 段历史区间，用于明细展示与前瞻收益汇总统计。',
  years:
    '从数据库加载约多少年内的日 K 作为搜索池（上限约 years×260 根）。年数越大可在越长的过去里找相似走势，取决于库内实际同步了多少历史。',
  horizons:
    '对每段相似历史，从其最后一个交易日收盘价起，统计之后 N 个交易日的涨跌幅，用于汇总胜率、平均收益等。',
  useChips:
    '开启后在相似度计算中纳入筹码分布特征（获利比例、成本偏离、集中度等）。数据来自库表 stock_chip，需先执行 stock-backtest db-sync-chips 或同步时加 --with-chips。',
} as const

function FieldLabel({ label, tip, required }: { label: string; tip: string; required?: boolean }) {
  return (
    <Space size={4}>
      <span>
        {label}
        {required ? <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span> : null}
      </span>
      <Tooltip title={tip} styles={{ body: { maxWidth: 360 } }}>
        <QuestionCircleOutlined
          style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, cursor: 'help' }}
          aria-label={`${label}说明`}
        />
      </Tooltip>
    </Space>
  )
}

function pct(v: number | null | undefined, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

function simPct(v: number) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function errorMessage(err: unknown) {
  if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'detail' in err.body) {
    const d = (err.body as { detail: unknown }).detail
    if (typeof d === 'string') return d
  }
  if (err instanceof Error) return err.message
  return '请求失败'
}

function buildMatchColumns(horizons: number[]) {
  const retCols = horizons.map((h) => ({
    title: `${h}日收益`,
    key: `ret_${h}`,
    width: 100,
    render: (_: unknown, row: BacktestMatchRow) => pct(row.forward_returns[String(h)] ?? null),
  }))
  return [
    {
      title: '相似区间',
      key: 'range',
      width: 200,
      render: (_: unknown, row: BacktestMatchRow) => `${row.match_start} ~ ${row.match_end}`,
    },
    {
      title: '相似度',
      dataIndex: 'similarity',
      width: 90,
      sorter: (a: BacktestMatchRow, b: BacktestMatchRow) => a.similarity - b.similarity,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => simPct(v),
    },
    ...retCols,
  ]
}

function summaryColumns() {
  return [
    { title: '前瞻(日)', dataIndex: 'horizon_days', width: 90 },
    { title: '样本数', dataIndex: 'sample_count', width: 80 },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      width: 90,
      render: (v: number) => pct(v),
    },
    {
      title: '平均收益',
      dataIndex: 'avg_return',
      width: 100,
      render: (v: number) => pct(v),
    },
    {
      title: '中位数',
      dataIndex: 'median_return',
      width: 100,
      render: (v: number) => pct(v),
    },
    {
      title: '最大',
      dataIndex: 'max_return',
      width: 90,
      render: (v: number) => pct(v),
    },
    {
      title: '最小',
      dataIndex: 'min_return',
      width: 90,
      render: (v: number) => pct(v),
    },
    {
      title: '标准差',
      dataIndex: 'std_return',
      width: 90,
      render: (v: number) => pct(v),
    },
  ]
}

export function BacktestPage() {
  const [code, setCode] = useState('600519')
  const [window, setWindow] = useState(30)
  const [topK, setTopK] = useState(15)
  const [horizons, setHorizons] = useState('5,10,20')
  const [years, setYears] = useState(10)
  const [useChips, setUseChips] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      fetchBacktestRun({
        code,
        window,
        top_k: topK,
        horizons,
        years,
        use_chips: useChips,
      }),
  })

  const data: BacktestRunResponse | undefined = mutation.data
  const horizonDays = useMemo(
    () => (data?.summary ?? []).map((s: BacktestForwardStats) => s.horizon_days),
    [data?.summary],
  )

  const title =
    data?.name && data?.code ? `${data.name}（${data.code}）` : data?.code ? data.code : '历史回测'

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        历史回测
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        以最近一段 K 线形态在库内历史中检索相似片段，并统计各片段之后 N 个交易日的收益分布（逻辑对齐{' '}
        <code>stock-backtest run</code>，行情默认来自 MySQL 日 K）。
      </Typography.Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical" onFinish={() => mutation.mutate()}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label={<FieldLabel label="股票代码" tip={FIELD_TIPS.code} required />}>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位代码"
                  maxLength={6}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item label={<FieldLabel label="对比窗口" tip={FIELD_TIPS.window} />}>
                <InputNumber min={10} max={120} value={window} onChange={(v) => setWindow(v ?? 30)} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item label={<FieldLabel label="Top K" tip={FIELD_TIPS.topK} />}>
                <InputNumber min={1} max={50} value={topK} onChange={(v) => setTopK(v ?? 15)} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Item label={<FieldLabel label="历史年数" tip={FIELD_TIPS.years} />}>
                <InputNumber min={1} max={30} value={years} onChange={(v) => setYears(v ?? 10)} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label={<FieldLabel label="前瞻周期" tip={FIELD_TIPS.horizons} />}>
                <Select value={horizons} onChange={setHorizons} options={HORIZON_PRESETS} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label={<FieldLabel label="筹码相似度" tip={FIELD_TIPS.useChips} />}
            style={{ marginBottom: 0 }}
          >
            <Switch checked={useChips} onChange={setUseChips} checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              开始回测
            </Button>
          </div>
        </Form>
      </Card>

      {mutation.isError && (
        <Alert type="error" message={errorMessage(mutation.error)} showIcon style={{ marginBottom: 16 }} />
      )}

      {mutation.isPending && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="相似走势匹配中，约需数秒至一分钟…" />
        </div>
      )}

      {data && !mutation.isPending && (
        <>
          <Card
            title={
              <Space>
                <span>{title}</span>
                <Link
                  to={`/${data.code}?name=${encodeURIComponent(data.name || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看 K 线
                </Link>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="查询窗口">
                {data.query_window.start} ~ {data.query_window.end}（{data.query_window.bars} 根）
              </Descriptions.Item>
              <Descriptions.Item label="最新收盘">
                {data.latest.trade_date} · {data.latest.close.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="库内 K 线">
                {data.data_bars} 根
              </Descriptions.Item>
              <Descriptions.Item label="MACD 柱">
                {data.latest.macd_hist?.toFixed(4) ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="RSI">
                {data.latest.rsi?.toFixed(1) ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="量比">
                {data.latest.volume_ratio?.toFixed(2) ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="筹码参与匹配">
                {data.chips_in_similarity ? (
                  <Tag color="green">
                    是
                    {data.chips_source === 'db' ? '（库内）' : ''}
                  </Tag>
                ) : (
                  <Tag>否</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Typography.Title level={5}>前瞻收益汇总</Typography.Title>
          <Table<BacktestForwardStats>
            rowKey="horizon_days"
            size="small"
            pagination={false}
            dataSource={data.summary}
            columns={summaryColumns()}
            style={{ marginBottom: 24 }}
          />

          <Typography.Title level={5}>相似历史片段（{data.matches.length}）</Typography.Title>
          <Table<BacktestMatchRow>
            rowKey={(r) => `${r.match_start}-${r.match_end}`}
            size="small"
            dataSource={data.matches}
            columns={buildMatchColumns(horizonDays)}
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: 560 }}
          />
        </>
      )}
    </div>
  )
}
