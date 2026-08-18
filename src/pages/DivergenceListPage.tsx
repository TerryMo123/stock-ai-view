import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Input, Row, Select, Table, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { fetchDivergenceScreen } from '@/api/endpoints/divergence'
import type { DivergenceByCodeRow, Timeframe } from '@/api/types'

const TF_OPTIONS = [
  { value: 'daily', label: '日线' },
  { value: 'weekly', label: '周线' },
  { value: 'monthly', label: '月线' },
  { value: 'yearly', label: '年线' },
]

/** 与后端 days 参数一致：按全库交易日倒数取 cutoff */
const DAYS_OPTIONS = [
  { label: '近7天', value: 7 },
  { label: '近1月', value: 22 },
  { label: '近半年', value: 120 },
  { label: '近1年', value: 252 },
] as const

const DEFAULT_DAYS = DAYS_OPTIONS[0].value

const TF_LABEL: Record<Timeframe, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
  half_year: '半年',
  yearly: '年',
}

function kindLabel(kind: 'top' | 'bottom') {
  return kind === 'top' ? '顶背离' : '底背离'
}

/** 周期且 + 类型：每个所选周期都须在时间范围内出现对应类型的背离 */
function matchesScreenCriteria(
  row: DivergenceByCodeRow,
  activeTf: string[],
  activeKinds: string[],
): boolean {
  if (!activeTf.length) return false
  return activeTf.every((t) => {
    const kind = row.timeframes[t as Timeframe]
    if (!kind) return false
    if (!activeKinds.length) return true
    return activeKinds.includes(kind)
  })
}

function formatSignalDates(row: DivergenceByCodeRow, activeTf: string[]) {
  const parts = activeTf
    .map((t) => {
      const d = row.signal_dates?.[t as Timeframe]
      if (!d) return null
      return `${TF_LABEL[t as Timeframe] ?? t} ${d}`
    })
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

export function DivergenceListPage() {
  const defaultTf = ['daily']

  const [draftDays, setDraftDays] = useState(DEFAULT_DAYS)
  const [draftTf, setDraftTf] = useState<string[]>(defaultTf)
  const [draftKinds, setDraftKinds] = useState<string[]>([])

  const [days, setDays] = useState(DEFAULT_DAYS)
  const [tf, setTf] = useState<string[]>(defaultTf)
  const [kinds, setKinds] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const tfParam = tf.join(',')
  const kindsParam = kinds.length ? kinds.join(',') : undefined

  const { data, isLoading, error } = useQuery({
    queryKey: ['screen', 'divergence', days, tfParam, kindsParam],
    queryFn: () => fetchDivergenceScreen({ days, tf: tfParam, kinds: kindsParam }),
  })

  const tableData = useMemo(() => {
    const rows = [...(data?.by_code ?? [])]
      .filter((row) => matchesScreenCriteria(row, tf, kinds))
      .sort((a, b) => {
        const da = a.latest_signal_date ?? ''
        const db = b.latest_signal_date ?? ''
        return db.localeCompare(da)
      })
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.code.includes(q) || row.name.toLowerCase().includes(q))
  }, [data?.by_code, keyword, tf, kinds])

  const resetToFirstPage = () => setPage(1)

  const columns = useMemo(() => {
    const tfCols = tf.map((t) => ({
      title: TF_LABEL[t as Timeframe] ?? t,
      key: t,
      render: (_: unknown, row: DivergenceByCodeRow) => {
        const k = row.timeframes[t as Timeframe]
        if (!k) return '—'
        return <Tag color={k === 'top' ? 'green' : 'red'}>{kindLabel(k)}</Tag>
      },
    }))
    return [
      {
        title: '代码',
        dataIndex: 'code',
        render: (code: string, row: DivergenceByCodeRow) => {
          const params = new URLSearchParams()
          if (row.name?.trim()) params.set('name', row.name.trim())
          const qs = params.toString()
          return (
            <Link
              to={`/${code}${qs ? `?${qs}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {code}
            </Link>
          )
        },
      },
      { title: '名称', dataIndex: 'name' },
      ...tfCols,
      {
        title: '背离发生日',
        key: 'signal_dates',
        width: 240,
        render: (_: unknown, row: DivergenceByCodeRow) => formatSignalDates(row, tf),
      },
      { title: '摘要', dataIndex: 'summary', ellipsis: true },
    ]
  }, [tf])

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        MACD 背离列表
      </Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text type="secondary">时间范围</Typography.Text>
            <Select
              value={draftDays}
              onChange={setDraftDays}
              options={DAYS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              style={{ width: '100%', marginTop: 6 }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Typography.Text type="secondary">周期</Typography.Text>
            <Select
              mode="multiple"
              value={draftTf}
              onChange={(v) => setDraftTf(v.length ? v : defaultTf)}
              options={TF_OPTIONS}
              style={{ width: '100%', marginTop: 6 }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Typography.Text type="secondary">类型</Typography.Text>
            <Select
              mode="multiple"
              allowClear
              placeholder="全部"
              value={draftKinds}
              onChange={setDraftKinds}
              style={{ width: '100%', marginTop: 6 }}
              options={[
                { value: 'top', label: '顶背离' },
                { value: 'bottom', label: '底背离' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Typography.Text type="secondary">搜索</Typography.Text>
            <Input
              allowClear
              placeholder="代码/名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </Col>
          <Col xs={24}>
            <Row justify="end" gutter={8}>
              <Col>
                <Button
                  onClick={() => {
                    setDraftDays(DEFAULT_DAYS)
                    setDraftTf(defaultTf)
                    setDraftKinds([])
                    setDays(DEFAULT_DAYS)
                    setTf(defaultTf)
                    setKinds([])
                    resetToFirstPage()
                  }}
                >
                  重置
                </Button>
              </Col>
              <Col>
                <Button
                  type="primary"
                  disabled={!draftTf.length}
                  onClick={() => {
                    if (!draftTf.length) return
                    setDays(draftDays)
                    setTf(draftTf)
                    setKinds(draftKinds)
                    resetToFirstPage()
                  }}
                >
                  查询
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" message="加载失败" description={String(error)} showIcon />}

      <Table<DivergenceByCodeRow>
        rowKey="code"
        loading={isLoading}
        dataSource={tableData}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: tableData.length,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
          },
        }}
        size="middle"
        scroll={{ x: 1100 }}
      />
    </div>
  )
}
