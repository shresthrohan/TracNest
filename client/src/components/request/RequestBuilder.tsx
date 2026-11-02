import { Loader2, Send } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { JsonEditor } from '@/components/JsonEditor'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthEditor } from './AuthEditor'
import { methodColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { METHODS, type KV, type Method, type RequestSpec } from '@/types'

const enc = encodeURIComponent
const dec = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s } }

/** spec.url holds the base URL only; enabled query rows are shown after "?". */
const compose = (url: string, query: KV[]) => {
  const q = query.filter((r) => r.enabled && r.key).map((r) => `${enc(r.key)}=${enc(r.value)}`).join('&')
  return q ? `${url}?${q}` : url
}
function split(text: string): { url: string; params: KV[] } {
  const i = text.indexOf('?')
  if (i < 0) return { url: text, params: [] }
  const params = text.slice(i + 1).split('&').filter(Boolean).map((p) => {
    const j = p.indexOf('=')
    return { key: dec(j < 0 ? p : p.slice(0, j)), value: j < 0 ? '' : dec(p.slice(j + 1)), enabled: true }
  })
  return { url: text.slice(0, i), params }
}

export function RequestBuilder({ value, onChange, onSend, sending }: {
  value: RequestSpec
  onChange: (v: RequestSpec) => void
  onSend: () => void
  sending: boolean
}) {
  // Local text keeps in-progress edits like a trailing "?" that would otherwise be dropped by the round trip.
  const [text, setText] = useState<string | null>(null)
  const composed = compose(value.url, value.query)
  const shown = text !== null && (() => { const s = split(text); return compose(s.url, s.params) === composed })() ? text : composed

  const editUrl = (t: string) => {
    setText(t)
    const { url, params } = split(t)
    onChange({ ...value, url, query: [...value.query.filter((r) => !r.enabled), ...params] })
  }
  const keyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!sending) onSend() }
  }
  const count = (rows: KV[]) => rows.filter((r) => r.enabled && r.key).length
  const set = <K extends keyof RequestSpec>(k: K, v: RequestSpec[K]) => onChange({ ...value, [k]: v })

  return (
    <div onKeyDown={keyDown} className="space-y-3">
      <div className="flex gap-2">
        <Select value={value.method} onValueChange={(m) => set('method', m as Method)}>
          <SelectTrigger className={cn('h-9 w-28 font-mono text-xs font-semibold', methodColor[value.method])}><SelectValue /></SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => <SelectItem key={m} value={m} className={cn('font-mono text-xs font-semibold', methodColor[m])}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="h-9 font-mono text-xs"
          placeholder="https://api.example.com/users"
          value={shown}
          onChange={(e) => editUrl(e.target.value)}
          spellCheck={false}
          aria-label="Request URL"
        />
        <Button className="h-9" onClick={onSend} disabled={sending || !value.url.trim()} title="Send (Ctrl/Cmd+Enter)">
          {sending ? <Loader2 className="animate-spin" /> : <Send />}Send
        </Button>
      </div>

      <Tabs defaultValue="params">
        <TabsList variant="line">
          <TabsTrigger value="params">Params{count(value.query) > 0 && <Count n={count(value.query)} />}</TabsTrigger>
          <TabsTrigger value="headers">Headers{count(value.headers) > 0 && <Count n={count(value.headers)} />}</TabsTrigger>
          <TabsTrigger value="auth">Auth{value.auth.type !== 'none' && <span className="ml-1.5 size-1.5 rounded-full bg-primary" />}</TabsTrigger>
          <TabsTrigger value="body">Body{value.body.mode !== 'none' && <span className="ml-1.5 size-1.5 rounded-full bg-primary" />}</TabsTrigger>
        </TabsList>
        <TabsContent value="params" className="pt-3">
          <KeyValueEditor rows={value.query} onChange={(q) => { setText(null); set('query', q) }} />
        </TabsContent>
        <TabsContent value="headers" className="pt-3">
          <KeyValueEditor rows={value.headers} onChange={(h) => set('headers', h)} keyPlaceholder="Header" />
        </TabsContent>
        <TabsContent value="auth" className="pt-3">
          <AuthEditor value={value.auth} onChange={(a) => set('auth', a)} />
        </TabsContent>
        <TabsContent value="body" className="space-y-3 pt-3">
          <Select value={value.body.mode} onValueChange={(m) => set('body', { ...value.body, mode: m as RequestSpec['body']['mode'] })}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No body</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="text">Plain text</SelectItem>
            </SelectContent>
          </Select>
          {value.body.mode === 'json' && (
            <div className="overflow-hidden rounded-md border"><JsonEditor value={value.body.content} onChange={(c) => set('body', { ...value.body, content: c })} minHeight="160px" /></div>
          )}
          {value.body.mode === 'text' && (
            <Textarea className="min-h-40 font-mono text-xs" value={value.body.content} onChange={(e) => set('body', { ...value.body, content: e.target.value })} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const Count = ({ n }: { n: number }) => (
  <span className="ml-1.5 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{n}</span>
)
