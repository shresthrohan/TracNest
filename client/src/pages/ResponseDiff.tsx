import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { GitCompareArrows, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatMs, prettyBody, timeAgo } from '@/lib/format'
import { useDebounced } from '@/hooks/useDebounced'
import { DiffTree } from '@/components/DiffTree'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { DiffKind, DiffResult, Execution, HistoryPage } from '@/types'

const optionText = (e: Execution) => `${e.request.method} ${e.request.url}  ${e.statusCode ?? e.error?.code ?? 'ERR'}  ${timeAgo(e.executedAt)}`

function ExecPicker({ title, value, onChange }: { title: string; value: Execution | null; onChange: (e: Execution) => void }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 300)
  const list = useQuery({
    queryKey: ['history', 'picker', dq],
    queryFn: () => api<HistoryPage>(`/history?limit=50${dq ? `&q=${encodeURIComponent(dq)}` : ''}`),
    placeholderData: keepPreviousData,
  })
  const items = list.data?.items ?? []
  const options = value && !items.some((i) => i.id === value.id) ? [value, ...items] : items
  return (
    <div className="space-y-2 rounded-lg border bg-surface p-3">
      <p className="font-medium">{title}</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input className="h-8 pl-8" placeholder="Filter by URL" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.isError ? <p className="text-xs text-destructive">{list.error.message}</p> : (
        <Select value={value?.id} onValueChange={(id) => { const e = options.find((o) => o.id === id); if (e) onChange(e) }} disabled={list.isLoading}>
          <SelectTrigger className="h-8 w-full font-mono text-xs"><SelectValue placeholder={list.isLoading ? 'Loading' : options.length ? 'Choose a response' : 'No matching requests'} /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id} className="font-mono text-xs">{optionText(o)}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  )
}

const KINDS: { kind: DiffKind; label: string; cls: string }[] = [
  { kind: 'added', label: 'added', cls: 'text-success' },
  { kind: 'removed', label: 'removed', cls: 'text-destructive' },
  { kind: 'changed', label: 'changed', cls: 'text-warning' },
  { kind: 'type', label: 'type changes', cls: 'text-violet' },
]

function Raw({ title, exec }: { title: string; exec: Execution }) {
  const body = exec.responseBody ?? ''
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-surface p-3 font-mono text-xs">{prettyBody(body) ?? (body || 'Empty body')}</pre>
    </div>
  )
}

export default function ResponseDiff() {
  const [a, setA] = useState<Execution | null>(null)
  const [b, setB] = useState<Execution | null>(null)
  const [raw, setRaw] = useState(false)
  const ready = !!a && !!b
  const diff = useQuery({ queryKey: ['diff', a?.id, b?.id], queryFn: () => api<DiffResult>(`/diff?a=${a!.id}&b=${b!.id}`), enabled: ready })
  const bodies = useQuery({
    queryKey: ['diff-bodies', a?.id, b?.id],
    queryFn: () => Promise.all([api<Execution>(`/history/${a!.id}`), api<Execution>(`/history/${b!.id}`)]),
    enabled: ready,
  })
  const d = diff.data
  const [ea, eb] = bodies.data ?? []
  const parse = (e?: Execution) => { try { return JSON.parse(e?.responseBody ?? '') } catch { return undefined } }
  const pa = parse(ea)
  const pb = parse(eb)
  const showRaw = raw || d?.bodyKind === 'text' || pa === undefined || pb === undefined
  const same = d && d.changes.length === 0 && d.status?.before === d.status?.after

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-base font-semibold">Response Diff</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <ExecPicker title="Before" value={a} onChange={setA} />
        <ExecPicker title="After" value={b} onChange={setB} />
      </div>

      {!ready ? (
        <div className="rounded-lg border bg-surface">
          <EmptyState icon={GitCompareArrows} title="Pick two responses to compare" description="Choose an earlier and a later run, for example the same endpoint before and after a deploy. Both come from your request history." />
        </div>
      ) : diff.isLoading || bodies.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : diff.isError ? (
        <ErrorState message={diff.error.message} onRetry={() => diff.refetch()} />
      ) : bodies.isError ? (
        <ErrorState message={bodies.error.message} onRetry={() => bodies.refetch()} />
      ) : d && ea && eb ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {d.status && d.status.before !== d.status.after && (
              <span className="flex items-center gap-1.5 text-muted-foreground">Status <StatusBadge code={d.status.before} /> to <StatusBadge code={d.status.after} /></span>
            )}
            <span className="font-mono text-xs text-muted-foreground">{formatMs(ea.responseTime)} to {formatMs(eb.responseTime)}</span>
            {KINDS.map(({ kind, label, cls }) => {
              const n = d.changes.filter((c) => c.kind === kind).length
              return <span key={kind} className={cn('text-xs', n ? cls : 'text-muted-foreground')}>{n} {label}</span>
            })}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={showRaw ? 'ghost' : 'secondary'} disabled={d.bodyKind === 'text' || pa === undefined || pb === undefined} onClick={() => setRaw(false)}>Changes</Button>
              <Button size="sm" variant={showRaw ? 'secondary' : 'ghost'} onClick={() => setRaw(true)}>Side by side</Button>
            </div>
          </div>
          {d.bodyKind === 'text' && <p className="text-xs text-muted-foreground">These responses are not JSON, so they are compared as plain text.</p>}
          {same && <p className="text-muted-foreground">The two responses are identical.</p>}
          {showRaw ? (
            <div className="grid gap-3 md:grid-cols-2"><Raw title="Before" exec={ea} /><Raw title="After" exec={eb} /></div>
          ) : (
            <DiffTree key={`${ea.id}:${eb.id}`} a={pa} b={pb} changes={d.changes} />
          )}
        </div>
      ) : null}
    </div>
  )
}
