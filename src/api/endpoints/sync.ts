import { apiGet } from '@/api/client'
import type {
  PaginatedResponse,
  SyncFailureGroup,
  SyncRecordItem,
  SyncSummaryResponse,
} from '@/api/types'

export function fetchSyncSummary() {
  return apiGet<SyncSummaryResponse>('/api/sync/summary')
}

export function fetchSyncFailures(limit = 15) {
  return apiGet<{ items: SyncFailureGroup[] }>('/api/sync/failures', { limit })
}

export function fetchSyncRecords(
  page = 1,
  pageSize = 50,
  status?: string,
) {
  return apiGet<PaginatedResponse<SyncRecordItem>>('/api/sync/records', {
    page,
    page_size: pageSize,
    status,
  })
}

export function fetchSyncFailed(page = 1, pageSize = 50) {
  return fetchSyncRecords(page, pageSize, 'failed')
}
