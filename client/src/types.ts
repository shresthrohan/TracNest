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
  | 'BLOCKED' | 'TIMEOUT' | 'DNS' | 'CONNECTION' | 'TOO_LARGE' | 'INVALID_URL' | 'INVALID_REQUEST' | 'TOO_MANY_REDIRECTS'

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

export type Collection = { id: string; name: string; description?: string; requestCount: number; createdAt: string }
export type SavedRequest = { id: string; collectionId: string; name: string; order: number; spec: RequestSpec }

export type AssertionKind = 'status' | 'maxTime' | 'exists' | 'equals' | 'type' | 'contains'
export type Assertion = { id: string; kind: AssertionKind; path?: string; expected?: unknown }
export type AssertionResult = { id: string; passed: boolean; actual?: unknown; message: string }
export type DiffKind = 'added' | 'removed' | 'changed' | 'type'
export type DiffChange = { path: string; kind: DiffKind; before?: unknown; after?: unknown }
export type TestSuite = {
  id: string
  requestId: string
  name: string
  assertions: Assertion[]
  lastRun?: {
    executionId: string
    results: AssertionResult[]
    passed: number
    failed: number
    durationMs: number
    ranAt: string
    error?: { code: string; message: string }
    regression?: { changes: DiffChange[]; newlyFailing: string[] }
  }
}
export type DiffResult = {
  a: Partial<Execution>
  b: Partial<Execution>
  changes: DiffChange[]
  status?: { before?: number; after?: number }
  bodyKind: 'json' | 'text'
}

export type MonitorStatus = 'pending' | 'up' | 'down'
export type Monitor = {
  id: string
  name: string
  spec: RequestSpec
  intervalSec: number
  expectedStatus: number
  active: boolean
  nextRunAt: string
  lastCheckedAt?: string
  currentStatus: MonitorStatus
  uptime24h: number | null
  avgMs24h: number | null
  createdAt: string
}
export type MonitorCheck = {
  id: string
  monitorId: string
  ok: boolean
  statusCode?: number
  responseTime: number
  error?: { code: string; message: string }
  anomaly: boolean
  checkedAt: string
}
export type MonitorStats = {
  uptime: number | null
  avgMs: number | null
  failed: number
  total: number
  series: MonitorCheck[]
  anomalies: MonitorCheck[]
}
export type AiExplanation = { explanation: string; causes: string[]; steps: string[]; assertions: Assertion[] }
