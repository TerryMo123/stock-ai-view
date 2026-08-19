import { apiGet, apiPost } from '@/api/client'
import type {
  PaginatedResponse,
  SyncFailureGroup,
  SyncJobStatus,
  SyncMode,
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

export function fetchSyncJob() {
  return apiGet<SyncJobStatus>('/api/sync/job')
}

export function triggerSync(body: {
  mode?: SyncMode
  pool?: string
  workers?: number
  years?: number
}) {
  return apiPost<SyncJobStatus>('/api/sync/trigger', body)
}
