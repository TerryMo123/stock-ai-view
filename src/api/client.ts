const TOKEN_KEY = 'stock_ai_token'
const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? APP_BASE).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function redirectToLogin() {
  const loginPath = `${APP_BASE}/login`
  const current = window.location.pathname
  if (current === loginPath || current.startsWith(`${loginPath}/`)) return
  let from = current + window.location.search
  if (APP_BASE && from.startsWith(APP_BASE)) {
    from = from.slice(APP_BASE.length) || '/'
  }
  window.location.href = `${loginPath}?from=${encodeURIComponent(from)}`
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  if (typeof body === 'string' && body.trim()) {
    const trimmed = body.trim()
    if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html')) {
      return `${fallback}（网关/服务器返回了网页而非 JSON，常见原因：超时或 502）`
    }
    return trimmed.slice(0, 200)
  }
  return fallback
}

async function readPayload(res: Response): Promise<{ json?: unknown; text: string }> {
  const text = await res.text()
  if (!text) return { text: '' }
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { text }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let res: Response
  try {
    res = await fetch(url, { ...init, headers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ApiError(`网络请求失败：${msg}`, 0)
  }
  const payload = await readPayload(res)
  if (res.status === 401) {
    const isLogin = path.includes('/api/auth/login')
    if (!isLogin) {
      clearAuthToken()
      redirectToLogin()
    }
    throw new ApiError(errorMessage(payload.json ?? payload.text, '请先登录'), 401, payload.json ?? payload.text)
  }
  if (!res.ok) {
    throw new ApiError(
      errorMessage(payload.json ?? payload.text, res.statusText || `HTTP ${res.status}`),
      res.status,
      payload.json ?? payload.text,
    )
  }
  if (res.status === 204) return undefined as T
  if (payload.json !== undefined) return payload.json as T
  throw new ApiError(
    `服务器未返回 JSON（HTTP ${res.status}）。若分析较久，可能是网关超时，请稍后重试或联系管理员加长超时。`,
    res.status,
    payload.text,
  )
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return request<T>(url.toString())
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
