import { apiGet } from '@/api/client'
import type { ChartTimeframe, DailyBar, IndicatorPoint, StockDivergenceEvent } from '@/api/types'

export function fetchStockDaily(
  code: string,
  params?: { start?: string; end?: string; limit?: number; tf?: ChartTimeframe },
) {
  return apiGet<{ code: string; timeframe: ChartTimeframe; items: DailyBar[] }>(
    `/api/stocks/${code}/daily`,
    params,
  )
}

export function fetchStockIndicators(
  code: string,
  params?: { start?: string; end?: string; limit?: number; tf?: ChartTimeframe },
) {
  return apiGet<{ code: string; timeframe: ChartTimeframe; items: IndicatorPoint[] }>(
    `/api/stocks/${code}/indicators`,
    params,
  )
}

export function fetchStockDivergence(
  code: string,
  params?: { tf?: string; days?: number },
) {
  return apiGet<{ code: string; cutoff_date: string; items: StockDivergenceEvent[] }>(
    `/api/stocks/${code}/divergence`,
    params,
  )
}
