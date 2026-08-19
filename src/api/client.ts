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
  return fallback
}

async function parseBody(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return await res.text()
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    const body = await parseBody(res)
    const isLogin = path.includes('/api/auth/login')
    if (!isLogin) {
      clearAuthToken()
      redirectToLogin()
    }
    throw new ApiError(errorMessage(body, '请先登录'), 401, body)
  }
  if (!res.ok) {
    const body = await parseBody(res)
    throw new ApiError(errorMessage(body, res.statusText || `HTTP ${res.status}`), res.status, body)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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
