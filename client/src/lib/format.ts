import type { Method } from '@/types'

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`

export const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`)

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted'

export function statusTone(code?: number): Tone {
  if (!code) return 'danger'
  if (code < 300) return 'success'
  if (code < 400) return 'info'
  if (code < 500) return 'warning'
  return 'danger'
}

export const toneBg: Record<Tone, string> = {
  success: 'bg-success/12 text-success',
  info: 'bg-info/12 text-info',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  muted: 'bg-muted text-muted-foreground',
}

export const methodColor: Record<Method, string> = {
  GET: 'text-success',
  POST: 'text-warning',
  PUT: 'text-info',
  PATCH: 'text-violet',
  DELETE: 'text-destructive',
}

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const prettyBody = (body: string) => {
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return null }
}

/** Parse a set-cookie header (string or array) into name/value/attributes. */
export function parseCookies(h?: string | string[]) {
  if (!h) return []
  return (Array.isArray(h) ? h : [h]).map((c) => {
    const [pair, ...attrs] = c.split(';')
    const i = pair.indexOf('=')
    return { name: pair.slice(0, i), value: pair.slice(i + 1), attrs: attrs.map((a) => a.trim()).join('; ') }
  })
}
