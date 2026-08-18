import { apiGet } from '@/api/client'
import type { BacktestRunResponse } from '@/api/types'

export interface BacktestRunParams {
  code: string
  window?: number
  top_k?: number
  horizons?: string
  years?: number
  use_chips?: boolean
}

export function fetchBacktestRun(params: BacktestRunParams) {
  const query: Record<string, string | number | undefined> = {
    code: params.code.trim(),
    window: params.window,
    top_k: params.top_k,
    horizons: params.horizons,
    years: params.years,
  }
  if (params.use_chips) query.use_chips = 'true'
  return apiGet<BacktestRunResponse>('/api/backtest/run', query)
}
