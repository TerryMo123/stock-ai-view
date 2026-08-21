import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  App,
} from 'antd'
import {
  CalculatorOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  PercentageOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMemo, useState, type ReactNode } from 'react'
import {
  fetchSyncJob,
  fetchSyncSchedule,
  fetchSyncSummary,
  triggerSync,
} from '@/api/endpoints/sync'
import type { SyncMode } from '@/api/types'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

const MODE_LABEL: Record<SyncMode, string> = {
  'latest-day': '当日增量',
  repair: '补缺失/缺口',
  'repair-failed': '仅补失败',
  'missing-history': '补未入库历史',
  'rescan-divergence': '背离重算',
  'sync-universe': '刷新股票列表',
  'sync-turnover': '补全换手率',
  'sync-chips': '计算筹码分布',
  'full-sync': '全市场重拉',
}

const MODE_HELP: Record<SyncMode, string> = {
  'latest-day': '检查全市场，只补落后于最新交易日的股票（日常收盘后用）。',
  repair: '补最近窗口缺天、落后、以及上次失败的股票。',
  'repair-failed': '只重跑 sync_meta=failed 的股票。',
  'missing-history': '补「名单有、日K没有/未成功」的股票（适合全量中断后收尾）。',
  'rescan-divergence': '不拉行情，用库内日K重算 MACD/背离并写回（改算法后用）。',
  'sync-universe': '仅刷新 stock_basic + 交易日历，不拉日K。',
  'sync-turnover': '用 Tushare daily_basic 只补缺换手率的交易日，不算筹码。',
  'sync-chips': '用库内日K+换手率本地递推筹码并写入 stock_chip（全池可能很久）。',
  'full-sync': '对股票池内全部股票按年数重拉（很慢，慎用）。',
}

const NO_YEARS_MODES: SyncMode[] = [
  'sync-universe',
  'rescan-divergence',
  'sync-turnover',
  'sync-chips',
]

type ActionDef = {
  mode: SyncMode
  title: string
  desc: string
  danger?: boolean
  primary?: boolean
  icon: ReactNode
  defaultYears?: number
}

const ACTIONS: ActionDef[] = [
  {
    mode: 'latest-day',
    title: '当日增量',
    desc: '补全市场最新交易日',
    primary: true,
    icon: <CloudDownloadOutlined />,
    defaultYears: 2,
  },
  {
    mode: 'repair-failed',
    title: '失败补全',
    desc: '重跑失败股票',
    icon: <WarningOutlined />,
    defaultYears: 35,
  },
  {
    mode: 'repair',
    title: '缺失/缺口补全',
    desc: '补缺天、落后与失败',
    icon: <DatabaseOutlined />,
    defaultYears: 15,
  },
  {
    mode: 'missing-history',
    title: '未入库历史补全',
    desc: '补名单有但无日K的票',
    icon: <DatabaseOutlined />,
    defaultYears: 35,
  },
  {
    mode: 'rescan-divergence',
    title: '背离补全/重算',
    desc: '库内日K重算背离',
    icon: <ReloadOutlined />,
    defaultYears: 15,
  },
  {
    mode: 'sync-turnover',
    title: '补全换手率',
    desc: 'Tushare 补缺换手率（不算筹码）',
    icon: <PercentageOutlined />,
  },
  {
    mode: 'sync-chips',
    title: '计算筹码分布',
    desc: '本地递推筹码写入 stock_chip',
    icon: <CalculatorOutlined />,
  },
  {
    mode: 'sync-universe',
    title: '刷新股票列表',
    desc: '更新板块名单与日历',
    icon: <ThunderboltOutlined />,
    defaultYears: 1,
  },
  {
    mode: 'full-sync',
    title: '全市场重拉',
    desc: '全池按年数重拉（耗时长）',
    danger: true,
    icon: <CloudDownloadOutlined />,
    defaultYears: 35,
  },
]

export function AdminPage() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [pool, setPool] = useState('all-a')
  const [workers, setWorkers] = useState(2)
  const [years, setYears] = useState(15)

  const summaryQ = useQuery({ queryKey: ['sync', 'summary'], queryFn: fetchSyncSummary })
  const scheduleQ = useQuery({ queryKey: ['sync', 'schedule'], queryFn: fetchSyncSchedule })
  const jobQ = useQuery({
    queryKey: ['sync', 'job'],
    queryFn: fetchSyncJob,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 1500 : 5000),
  })

  const mutation = useMutation({
    mutationFn: (mode: SyncMode) => {
      const action = ACTIONS.find((a) => a.mode === mode)
      return triggerSync({
        mode,
        pool,
        workers,
        years: action?.defaultYears ?? years,
      })
    },
    onSuccess: (data) => {
      if (data.accepted === false) {
        message.warning(data.message || '已有任务在运行')
      } else {
        message.success('任务已启动，下方可查看进度')
      }
      void queryClient.invalidateQueries({ queryKey: ['sync'] })
    },
    onError: (e) => {
      message.error(e instanceof Error ? e.message : '触发失败')
    },
  })

  const job = jobQ.data
  const running = job?.status === 'running' || mutation.isPending
  const progress = job?.progress
  const percent = useMemo(() => {
    if (!progress) return job?.status === 'running' ? 0 : undefined
    return progress.percent ?? 0
  }, [progress, job?.status])

  const runAction = (mode: SyncMode) => {
    const label = MODE_LABEL[mode]
    const help = MODE_HELP[mode]
    modal.confirm({
      title: `确认执行「${label}」？`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>{help}</p>
          <p style={{ marginBottom: 0, color: 'rgba(0,0,0,0.45)' }}>
            股票池 {pool} · 并发 {workers}
            {!NO_YEARS_MODES.includes(mode)
              ? ` · 年数 ${ACTIONS.find((a) => a.mode === mode)?.defaultYears ?? years}`
              : ''}
          </p>
        </div>
      ),
      okText: '开始',
      cancelText: '取消',
      okButtonProps: { danger: mode === 'full-sync' || mode === 'sync-chips' },
      onOk: () => mutation.mutateAsync(mode),
    })
  }

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        管理员操作
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        通过 Tushare 补全行情、换手率，或本地重算背离/筹码。同一时刻只能跑一个任务，进度见下方「任务进度」。
      </Typography.Paragraph>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
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
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="最新数据日期"
              value={(summaryQ.data?.latest_data_date || '—').toString().slice(0, 10)}
              loading={summaryQ.isLoading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="失败数"
              value={summaryQ.data?.by_status?.failed ?? 0}
              loading={summaryQ.isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Card title="任务进度" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <span>状态</span>
          <Tag
            color={
              job?.status === 'running' ? 'processing' : job?.status === 'failed' ? 'error' : 'default'
            }
          >
            {job?.status ?? '—'}
          </Tag>
          {job?.mode ? <Tag color="blue">{MODE_LABEL[job.mode] ?? job.mode}</Tag> : null}
          {job?.triggered_by ? <Tag>触发人 {job.triggered_by}</Tag> : null}
        </Space>

        {running || (progress && progress.total > 0) ? (
          <Progress
            percent={percent ?? 0}
            status={job?.status === 'failed' ? 'exception' : running ? 'active' : 'success'}
            format={(p) =>
              progress?.total
                ? `${progress.done}/${progress.total} (${p?.toFixed?.(1) ?? p}%)`
                : `${p}%`
            }
          />
        ) : (
          <Progress percent={job?.status === 'idle' && job?.stats ? 100 : 0} status="normal" />
        )}

        <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.65)' }}>{job?.message || '空闲，可发起任务'}</div>
        {progress?.current_code ? (
          <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)' }}>
            当前：{progress.current_code} {progress.current_name}
          </div>
        ) : null}
        {job?.stats ? (
          <div style={{ marginTop: 8 }}>
            成功 {job.stats.success} / 失败 {job.stats.failed} / 合计 {job.stats.total}
            {job.stats.bars != null ? ` · K线 ${job.stats.bars}` : ''}
            {job.stats.divergences != null ? ` · 背离 ${job.stats.divergences}` : ''}
            {job.stats.rows != null ? ` · 写入 ${job.stats.rows}` : ''}
            {job.stats.skipped != null ? ` · 跳过 ${job.stats.skipped}` : ''}
            {job.stats.stock_info != null ? ` · 列表 ${job.stats.stock_info}` : ''}
          </div>
        ) : null}
        <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
          开始 {formatDateTime(job?.started_at)} · 结束 {formatDateTime(job?.finished_at)}
        </div>
      </Card>

      {job?.status === 'failed' && job.message ? (
        <Alert type="error" showIcon message={job.message} style={{ marginBottom: 16 }} />
      ) : null}

      <Card title="运行参数" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>股票池</span>
          <Select
            value={pool}
            style={{ width: 140 }}
            onChange={setPool}
            disabled={running}
            options={[
              { value: 'all-a', label: '全A (all-a)' },
              { value: 'hs300', label: '沪深300' },
              { value: 'zz500', label: '中证500' },
              { value: 'sz50', label: '上证50' },
            ]}
          />
          <span>并发</span>
          <Select
            value={workers}
            style={{ width: 100 }}
            onChange={setWorkers}
            disabled={running}
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
          />
          <span>默认年数</span>
          <Select
            value={years}
            style={{ width: 100 }}
            onChange={setYears}
            disabled={running}
            options={[5, 10, 15, 20, 35].map((n) => ({ value: n, label: `${n}年` }))}
          />
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          各按钮若自带推荐年数（如失败补全 35 年），会覆盖「默认年数」。
        </Typography.Paragraph>
      </Card>

      <Card title="数据补全操作" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {ACTIONS.map((action) => (
            <Col xs={24} sm={12} lg={8} key={action.mode}>
              <Card size="small" type="inner" title={action.title}>
                <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
                  {action.desc}
                </Typography.Paragraph>
                <Button
                  type={action.primary ? 'primary' : 'default'}
                  danger={action.danger}
                  icon={action.icon}
                  block
                  loading={running && mutation.variables === action.mode}
                  disabled={running}
                  onClick={() => runAction(action.mode)}
                >
                  执行
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="自动日更调度" size="small">
        {scheduleQ.data ? (
          <Space direction="vertical" size={4}>
            <div>
              状态：
              <Tag color={scheduleQ.data.enabled ? 'green' : 'default'}>
                {scheduleQ.data.enabled ? '已开启' : '已关闭'}
              </Tag>
              每个交易日 {String(scheduleQ.data.hour).padStart(2, '0')}:
              {String(scheduleQ.data.minute).padStart(2, '0')}（{scheduleQ.data.timezone}）
            </div>
            <div>股票池 {scheduleQ.data.pool} · 并发 {scheduleQ.data.workers}</div>
            <div>下次计划：{formatDateTime(scheduleQ.data.next_run_at)}</div>
            <Typography.Text type="secondary">
              调度随 stock-api 进程启动；需 API_RELOAD=0 的常驻服务才稳定生效。
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">加载中…</Typography.Text>
        )}
      </Card>
    </div>
  )
}
