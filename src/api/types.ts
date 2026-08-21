export type DivergenceKind = 'top' | 'bottom'
export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'half_year' | 'yearly'

/** K 线图可选周期（与 API tf 参数一致） */
export type ChartTimeframe = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface HealthResponse {
  status: string
  database: string
}

export interface DivergenceScreenRow {
  code: string
  name: string | null
  timeframe: Timeframe
  kind: DivergenceKind
  signal_date: string
  later_date: string | null
}

export interface DivergenceScreenResponse {
  cutoff_date: string
  total: number
  items: DivergenceScreenRow[]
  by_code: DivergenceByCodeRow[]
}

export interface DivergenceByCodeRow {
  code: string
  name: string
  timeframes: Partial<Record<Timeframe, DivergenceKind>>
  signal_dates?: Partial<Record<Timeframe, string>>
  latest_signal_date?: string | null
  summary: string
}

export interface DailyBar {
  trade_date: string
  open_price: number
  high_price: number
  low_price: number
  close_price: number
  volume: number | null
  amount: number | null
  /** 换手率（%），日 K 来自库；周/月/年取区间末日 */
  turnover_rate?: number | null
}

export interface StockInfoRow {
  code: string
  ts_code: string
  name: string
  market: string
  industry: string
  list_status: string
  list_date: string | null
}

export interface StockBoardStat {
  market: string
  count: number
}

export interface StockBoardStatsResponse {
  total: number
  boards: StockBoardStat[]
}

export interface StockUniverseResponse {
  total: number
  page: number
  page_size: number
  items: StockInfoRow[]
}

export interface IndicatorPoint {
  trade_date: string
  macd_dif: number | null
  macd_dea: number | null
  macd_hist: number | null
  rsi: number | null
  volume_ratio: number | null
  kdj_k: number | null
  kdj_d: number | null
  kdj_j: number | null
}

export interface StockDivergenceEvent {
  id: number
  code: string
  name: string | null
  timeframe: Timeframe
  kind: DivergenceKind
  signal_date: string
  earlier_date: string | null
  later_date: string | null
  price_earlier: number | null
  price_later: number | null
  macd_earlier: number | null
  macd_later: number | null
  note: string | null
}

export interface SyncSummaryResponse {
  total: number
  by_status: Record<string, number>
  latest_sync_at?: string | null
  latest_data_date?: string | null
}

export interface SyncFailureGroup {
  err: string
  cnt: number
}

export interface SyncRecordItem {
  code: string
  status?: string | null
  message: string | null
  last_sync_at: string | null
  last_trade_date: string | null
}

/** @deprecated 使用 SyncRecordItem */
export type SyncFailedItem = SyncRecordItem

export interface PaginatedResponse<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export interface BacktestForwardStats {
  horizon_days: number
  sample_count: number
  win_rate: number
  avg_return: number
  median_return: number
  max_return: number
  min_return: number
  std_return: number
}

export interface BacktestMatchRow {
  match_start: string
  match_end: string
  similarity: number
  forward_returns: Record<string, number | null>
}

export interface BacktestRunResponse {
  code: string
  name: string
  query_window: { start: string; end: string; bars: number }
  latest: {
    trade_date: string
    close: number
    macd_hist: number | null
    rsi: number | null
    volume_ratio: number | null
  }
  chips_in_similarity: boolean
  /** 筹码来源：db=库内 / none=未使用 */
  chips_source?: 'db' | 'none'
  data_bars: number
  summary: BacktestForwardStats[]
  matches: BacktestMatchRow[]
}

export type UserRole = 'user' | 'admin'

export interface AuthUser {
  username: string
  role: UserRole
  display_name: string
  permissions: { trigger_sync: boolean }
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export type SyncMode =
  | 'latest-day'
  | 'repair'
  | 'repair-failed'
  | 'missing-history'
  | 'rescan-divergence'
  | 'sync-universe'
  | 'sync-turnover'
  | 'sync-chips'
  | 'full-sync'

export interface SyncJobProgress {
  done: number
  total: number
  percent: number
  current_code: string | null
  current_name: string | null
}

export interface SyncJobStatus {
  accepted?: boolean
  status: 'idle' | 'running' | 'failed'
  mode: SyncMode | null
  started_at: string | null
  finished_at: string | null
  message: string | null
  triggered_by: string | null
  progress?: SyncJobProgress | null
  stats: {
    total: number
    success: number
    failed: number
    bars?: number
    divergences?: number
    stock_info?: number
    trade_cal?: number
    rows?: number
    skipped?: number
  } | null
}

export interface SyncScheduleStatus {
  enabled: boolean
  hour: number
  minute: number
  timezone: string
  pool: string
  workers: number
  years: number
  running: boolean
  next_run_at: string | null
}
