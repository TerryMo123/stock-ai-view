import { apiPost, apiGet } from '@/api/client'
import type { LoginResponse, AuthUser } from '@/api/types'

export function login(username: string, password: string) {
  return apiPost<LoginResponse>('/api/auth/login', { username, password })
}

export function fetchMe() {
  return apiGet<AuthUser>('/api/auth/me')
}
