import { apiGet } from '@/api/client'
import type { StockBoardStatsResponse, StockUniverseResponse } from '@/api/types'

export function fetchStockBoards(params?: { list_status?: string }) {
  return apiGet<StockBoardStatsResponse>('/api/stocks/boards', params)
}

export function fetchStockIndustries(params?: { market?: string; list_status?: string }) {
  return apiGet<{ items: string[] }>('/api/stocks/industries', params)
}

export function fetchStockUniverse(params: {
  market?: string
  industry?: string
  q?: string
  list_status?: string
  page?: number
  page_size?: number
}) {
  return apiGet<StockUniverseResponse>('/api/stocks/universe', params)
}
