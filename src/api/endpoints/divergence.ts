import { apiGet } from '@/api/client'
import type { DivergenceScreenResponse } from '@/api/types'

export interface ScreenDivergenceParams {
  days?: number
  tf?: string
  kinds?: string
}

export function fetchDivergenceScreen(params: ScreenDivergenceParams = {}) {
  return apiGet<DivergenceScreenResponse>('/api/screen/divergence', {
    days: params.days ?? 7,
    tf: params.tf ?? 'daily',
    kinds: params.kinds,
  })
}
