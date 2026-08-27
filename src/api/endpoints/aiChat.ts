import { getAuthToken } from '@/api/client'

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? APP_BASE).replace(/\/$/, '')

export interface AiChatStreamBody {
  bootstrap?: boolean
  system?: string
  messages?: { role: 'user' | 'assistant'; content: string }[]
  lookback_days?: number
  include_chips?: boolean
  include_finance?: boolean
  include_news?: boolean
  include_capital?: boolean
  news_days?: number
  news_limit?: number
  capital_days?: number
  enrich_stocks?: boolean
}

export type AiChatSseEvent =
  | { type: 'status'; message: string }
  | {
      type: 'meta'
      code?: string
      name?: string
      model: string
      system: string
      user_message?: string
      suggestions?: string[]
      context_used?: Record<string, unknown>
      data_as_of?: Record<string, unknown>
      market_snapshot?: Record<string, unknown>
    }
  | { type: 'reasoning'; text: string }
  | { type: 'content'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done'; model?: string }

async function readSseStream(
  res: Response,
  onEvent: (ev: AiChatSseEvent) => void,
): Promise<void> {
  if (!res.body) throw new Error('浏览器不支持流式响应')
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          onEvent(JSON.parse(data) as AiChatSseEvent)
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function postStream(
  path: string,
  body: AiChatStreamBody,
  onEvent: (ev: AiChatSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const token = getAuthToken()
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    let detail = text.slice(0, 200)
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (j.detail) detail = j.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  await readSseStream(res, onEvent)
}

export function streamStockAIChat(
  code: string,
  body: AiChatStreamBody,
  onEvent: (ev: AiChatSseEvent) => void,
  signal?: AbortSignal,
) {
  return postStream(
    `/api/stocks/${encodeURIComponent(code)}/ai-chat/stream`,
    body,
    onEvent,
    signal,
  )
}

export function streamGeneralAIChat(
  body: AiChatStreamBody,
  onEvent: (ev: AiChatSseEvent) => void,
  signal?: AbortSignal,
) {
  return postStream('/api/ai/chat/stream', body, onEvent, signal)
}
