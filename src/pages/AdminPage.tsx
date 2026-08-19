import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Row, Space, Statistic, Tag, Typography, App } from 'antd'
import { CloudDownloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { fetchSyncJob, fetchSyncSummary, triggerSync } from '@/api/endpoints/sync'
import type { SyncMode } from '@/api/types'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

const MODE_LABEL: Record<SyncMode, string> = {
  'latest-day': '当日增量',
  repair: '补缺失',
  'repair-failed': '仅补失败',
}

export function AdminPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const summaryQ = useQuery({ queryKey: ['sync', 'summary'], queryFn: fetchSyncSummary })
  const jobQ = useQuery({
    queryKey: ['sync', 'job'],
    queryFn: fetchSyncJob,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : 8000),
  })

  const mutation = useMutation({
    mutationFn: (mode: SyncMode) => triggerSync({ mode, pool: 'all-a', workers: 2, years: 15 }),
    onSuccess: (data) => {
      if (data.accepted === false) {
        message.warning(data.message || '已有任务在运行')
      } else {
        message.success('已开始拉取，请稍后刷新同步状态')
      }
      void queryClient.invalidateQueries({ queryKey: ['sync'] })
    },
    onError: (e) => {
      message.error(e instanceof Error ? e.message : '触发失败')
    },
  })

  const job = jobQ.data
  const running = job?.status === 'running' || mutation.isPending

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        管理员操作
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        从东方财富拉取行情写入 MySQL。全市场耗时长，建议收盘后使用「当日增量」。
        详细记录见 <Link to="/sync">数据同步面板</Link>。
      </Typography.Paragraph>

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="同步记录" value={summaryQ.data?.total ?? '—'} loading={summaryQ.isLoading} />
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
        <Col xs={24} md={12}>
          <Card>
            <Space wrap>
              <span>当前任务</span>
              <Tag color={job?.status === 'running' ? 'processing' : job?.status === 'failed' ? 'error' : 'default'}>
                {job?.status ?? '—'}
              </Tag>
              {job?.mode ? <Tag>{MODE_LABEL[job.mode] ?? job.mode}</Tag> : null}
            </Space>
            <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.45)' }}>{job?.message || '空闲'}</div>
            {job?.stats ? (
              <div style={{ marginTop: 8 }}>
                成功 {job.stats.success} / 失败 {job.stats.failed} / 合计 {job.stats.total}
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>

      {job?.status === 'failed' && job.message ? (
        <Alert type="error" showIcon message={job.message} style={{ marginBottom: 16 }} />
      ) : null}

      <Card title="数据拉取">
        <Space wrap>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={running}
            disabled={running}
            onClick={() => mutation.mutate('latest-day')}
          >
            当日增量
          </Button>
          <Button loading={running} disabled={running} onClick={() => mutation.mutate('repair')}>
            补缺失
          </Button>
          <Button loading={running} disabled={running} onClick={() => mutation.mutate('repair-failed')}>
            仅补失败
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
          同一时刻只能跑一个任务。拉取过程中可离开本页，完成后在同步面板查看结果。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
