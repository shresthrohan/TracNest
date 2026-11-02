export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export type KV = { key: string; value: string; enabled: boolean }
export type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apikey'; key: string; value: string; in: 'header' | 'query' }

export type RequestSpec = {
  method: Method
  url: string
  query: KV[]
  headers: KV[]
  auth: AuthConfig
  body: { mode: 'none' | 'json' | 'text'; content: string }
}

export type ExecErrorCode =
  | 'BLOCKED' | 'TIMEOUT' | 'DNS' | 'CONNECTION' | 'TOO_LARGE' | 'INVALID_URL' | 'TOO_MANY_REDIRECTS'

export type ExecResult = {
  ok: boolean
  statusCode?: number
  statusText?: string
  headers: Record<string, string | string[]>
  body: string
  bodyTruncated: boolean
  size: number
  timeMs: number
  finalUrl: string
  redirects: string[]
  error?: { code: ExecErrorCode; message: string }
}

/** Stored execution as returned by /api/execute and /api/history/:id (list items omit responseBody). */
export type Execution = {
  id: string
  requestId?: string
  source: 'playground' | 'suite' | 'rerun'
  request: RequestSpec
  statusCode?: number
  responseTime: number
  responseSize: number
  responseBody?: string
  responseHeaders?: Record<string, string | string[]>
  error?: { code: ExecErrorCode; message: string }
  finalUrl?: string
  redirects?: string[]
  executedAt: string
}

export type HistoryPage = { items: Execution[]; total: number; page: number; pages: number }

export type User = { id: string; name: string; email: string }

export type Dashboard = {
  total: number
  success: number
  failed: number
  avgMs: number
  successRate: number
  recent: Execution[]
  failing: { method: string; url: string; failures: number; lastStatus?: number; lastAt: string }[]
  series: { bucket: string; avgMs: number; count: number; failed: number }[]
}

export const emptySpec = (): RequestSpec => ({
  method: 'GET',
  url: '',
  query: [],
  headers: [],
  auth: { type: 'none' },
  body: { mode: 'none', content: '' },
})
