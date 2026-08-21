import { useQuery } from '@tanstack/react-query'
import { Card, Input, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchStockBoards,
  fetchStockIndustries,
  fetchStockUniverse,
} from '@/api/endpoints/stocksUniverse'
import type { StockInfoRow } from '@/api/types'

const PAGE_SIZE = 50

export function StockListPage() {
  const [market, setMarket] = useState<string>('全部')
  const [industry, setIndustry] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [market, industry, qDebounced])

  const boardsQ = useQuery({
    queryKey: ['stocks', 'boards'],
    queryFn: () => fetchStockBoards(),
  })

  const industriesQ = useQuery({
    queryKey: ['stocks', 'industries', market],
    queryFn: () =>
      fetchStockIndustries({
        market: market === '全部' ? undefined : market,
      }),
  })

  const listQ = useQuery({
    queryKey: ['stocks', 'universe', market, industry, qDebounced, page],
    queryFn: () =>
      fetchStockUniverse({
        market: market === '全部' ? undefined : market,
        industry,
        q: qDebounced || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const tabItems = useMemo(() => {
    const boards = boardsQ.data?.boards ?? []
    const total = boardsQ.data?.total ?? 0
    return [
      { key: '全部', label: `全部 (${total})` },
      ...boards.map((b) => ({
        key: b.market,
        label: `${b.market} (${b.count})`,
      })),
    ]
  }, [boardsQ.data])

  const columns = [
    {
      title: '代码',
      dataIndex: 'code',
      width: 100,
      render: (code: string) => <Link to={`/${code}`}>{code}</Link>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, row: StockInfoRow) => (
        <Link to={`/${row.code}`}>{name || row.code}</Link>
      ),
    },
    {
      title: '板块',
      dataIndex: 'market',
      width: 100,
      render: (v: string) => (v ? <Tag>{v}</Tag> : '—'),
    },
    {
      title: '行业',
      dataIndex: 'industry',
      width: 140,
      render: (v: string) => v || '—',
    },
    {
      title: '上市日',
      dataIndex: 'list_date',
      width: 120,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Tushare',
      dataIndex: 'ts_code',
      width: 120,
      render: (v: string) => <Typography.Text type="secondary">{v || '—'}</Typography.Text>,
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        股票列表
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        全市场上市股票，按交易板块分组；点击代码可进入 K 线详情（需已同步日 K）。
      </Typography.Paragraph>

      <Card size="small">
        <Tabs
          activeKey={market}
          items={tabItems}
          onChange={(key) => {
            setMarket(key)
            setIndustry(undefined)
          }}
        />
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="搜索代码 / 名称"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            showSearch
            placeholder="行业筛选"
            optionFilterProp="label"
            style={{ minWidth: 180 }}
            value={industry}
            onChange={(v) => setIndustry(v)}
            options={(industriesQ.data?.items ?? []).map((name) => ({
              value: name,
              label: name,
            }))}
          />
        </Space>

        <Table<StockInfoRow>
          rowKey="code"
          size="middle"
          loading={listQ.isLoading || listQ.isFetching}
          columns={columns}
          dataSource={listQ.data?.items ?? []}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: listQ.data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 只`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </Space>
  )
}
