import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Row, Select, Statistic, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSyncFailures, fetchSyncRecords, fetchSyncSummary } from '@/api/endpoints/sync'
import type { SyncRecordItem } from '@/api/types'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

function statusTag(status: string | null | undefined) {
  if (!status) return '—'
  const color =
    status === 'ok' ? 'green' : status === 'failed' ? 'red' : status === 'pending' ? 'gold' : 'default'
  return <Tag color={color}>{status}</Tag>
}

export function SyncStatusPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const summaryQ = useQuery({ queryKey: ['sync', 'summary'], queryFn: fetchSyncSummary })
  const failuresQ = useQuery({ queryKey: ['sync', 'failures'], queryFn: () => fetchSyncFailures(15) })
  const recordsQ = useQuery({
    queryKey: ['sync', 'records', page, pageSize, statusFilter],
    queryFn: () => fetchSyncRecords(page, pageSize, statusFilter),
  })

  const byStatus = summaryQ.data?.by_status ?? {}

  const recordColumns = [
    {
      title: '代码',
      dataIndex: 'code',
      width: 100,
      fixed: 'left' as const,
      render: (c: string) => <Link to={`/${c}`}>{c}</Link>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => statusTag(s),
    },
    {
      title: '最近同步时间',
      dataIndex: 'last_sync_at',
      width: 170,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '最新数据日期',
      dataIndex: 'last_trade_date',
      width: 130,
      render: (v: string | null) => formatDate(v),
    },
    { title: '消息', dataIndex: 'message', ellipsis: true },
  ]

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        数据同步面板
      </Typography.Title>

      {(summaryQ.error || failuresQ.error || recordsQ.error) && (
        <Alert type="error" message="加载失败" showIcon style={{ marginBottom: 16 }} />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="总记录" value={summaryQ.data?.total ?? '—'} loading={summaryQ.isLoading} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="最近同步时间"
              value={formatDateTime(summaryQ.data?.latest_sync_at)}
              loading={summaryQ.isLoading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="最新数据日期"
              value={formatDate(summaryQ.data?.latest_data_date)}
              loading={summaryQ.isLoading}
            />
          </Card>
        </Col>
        {Object.entries(byStatus).map(([status, cnt]) => (
          <Col xs={12} md={6} key={status}>
            <Card>
              <Statistic title={status} value={cnt} loading={summaryQ.isLoading} />
            </Card>
          </Col>
        ))}
      </Row>

      <Typography.Title level={5}>失败原因 Top</Typography.Title>
      <Table
        size="small"
        rowKey="err"
        loading={failuresQ.isLoading}
        dataSource={failuresQ.data?.items ?? []}
        pagination={false}
        scroll={{ x: 560 }}
        columns={[
          { title: '原因', dataIndex: 'err', ellipsis: true },
          { title: '数量', dataIndex: 'cnt', width: 100 },
        ]}
        style={{ marginBottom: 32 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          同步记录
        </Typography.Title>
        <Select
          allowClear
          placeholder="全部状态"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={[
            { value: 'ok', label: 'ok' },
            { value: 'failed', label: 'failed' },
            { value: 'pending', label: 'pending' },
          ]}
        />
      </div>
      <Table<SyncRecordItem>
        rowKey="code"
        loading={recordsQ.isLoading}
        dataSource={recordsQ.data?.items ?? []}
        columns={recordColumns}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total: recordsQ.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      />
    </div>
  )
}
