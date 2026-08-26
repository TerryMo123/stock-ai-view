import { apiPost } from '@/api/client'
import type { StockAIAnalysisResponse } from '@/api/types'

export interface StockAIAnalysisParams {
  lookback_days?: number
  include_chips?: boolean
  include_finance?: boolean
  include_news?: boolean
  include_capital?: boolean
  news_days?: number
  news_limit?: number
  capital_days?: number
  style?: 'brief' | 'balanced' | 'detailed'
}

export function fetchStockAIAnalysis(code: string, params: StockAIAnalysisParams = {}) {
  const qs = new URLSearchParams()
  if (params.lookback_days != null) qs.set('lookback_days', String(params.lookback_days))
  if (params.style) qs.set('style', params.style)
  if (params.news_days != null) qs.set('news_days', String(params.news_days))
  if (params.news_limit != null) qs.set('news_limit', String(params.news_limit))
  if (params.capital_days != null) qs.set('capital_days', String(params.capital_days))
  if (params.include_chips === false) qs.set('include_chips', 'false')
  if (params.include_chips === true) qs.set('include_chips', 'true')
  if (params.include_finance === false) qs.set('include_finance', 'false')
  if (params.include_finance === true) qs.set('include_finance', 'true')
  if (params.include_news === false) qs.set('include_news', 'false')
  if (params.include_news === true) qs.set('include_news', 'true')
  if (params.include_capital === false) qs.set('include_capital', 'false')
  if (params.include_capital === true) qs.set('include_capital', 'true')
  const q = qs.toString()
  const path = `/api/stocks/${encodeURIComponent(code)}/ai-analysis${q ? `?${q}` : ''}`
  return apiPost<StockAIAnalysisResponse>(path)
}
