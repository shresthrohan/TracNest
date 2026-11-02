import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Loader2, Play, Plus, Save, Sparkles, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatMs, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AssertionEditor } from '@/components/AssertionEditor'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MethodLabel } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Assertion, AssertionResult, Collection, DiffChange, HistoryPage, Execution, SavedRequest, TestSuite } from '@/types'

const kindColor: Record<DiffChange['kind'], string> = { added: 'text-success', removed: 'text-destructive', changed: 'text-warning', type: 'text-violet' }
const show = (v: unknown) => (v === undefined ? '' : JSON.stringify(v))
const jsType = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
const label = (a?: Assertion) => (a ? `${a.kind}${a.path ? ` ${a.path}` : ''}` : 'assertion')

function NewSuiteDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: TestSuite) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [col, setCol] = useState('')
  const [req, setReq] = useState('')
  const cols = useQuery({ queryKey: ['collections'], queryFn: () => api<Collection[]>('/collections'), enabled: open })
  const colId = col || cols.data?.[0]?.id
  const reqs = useQuery({ queryKey: ['collection-requests', colId], queryFn: () => api<SavedRequest[]>(`/collections/${colId}/requests`), enabled: open && !!colId })
  const requestId = reqs.data?.some((r) => r.id === req) ? req : ''
  const create = useMutation({
    mutationFn: () => api<TestSuite>('/suites', { body: { requestId, name: name.trim(), assertions: [] } }),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ['suites'] }); setName(''); toast.success('Suite created'); onCreated(s) },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New test suite</DialogTitle>
          <DialogDescription>A suite runs one saved request and checks the response against your assertions.</DialogDescription>
        </DialogHeader>
        {cols.isLoading ? <Skeleton className="h-24 w-full" /> : !cols.data?.length ? (
          <p className="text-muted-foreground">Save a request to a collection from the Playground first.</p>
        ) : (
          <form id="suite-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() && requestId) create.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="s-name">Name</Label><Input id="s-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Collection</Label>
              <Select value={colId} onValueChange={(v) => { setCol(v); setReq('') }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{cols.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Request</Label>
              <Select value={requestId} onValueChange={setReq} disabled={!reqs.data?.length}>
                <SelectTrigger className="w-full"><SelectValue placeholder={reqs.isLoading ? 'Loading' : reqs.data?.length ? 'Choose a request' : 'No requests in this collection'} /></SelectTrigger>
                <SelectContent>{reqs.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.spec.method} {r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="suite-form" disabled={!name.trim() || !requestId || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SuiteDetail({ suite, onDeleted }: { suite: TestSuite; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(suite.name)
  const [draft, setDraft] = useState<Assertion[]>(suite.assertions)
  const [confirmDel, setConfirmDel] = useState(false)
  const dirty = name.trim() !== suite.name || JSON.stringify(draft) !== JSON.stringify(suite.assertions)
  const request = useQuery({ queryKey: ['request', suite.requestId], queryFn: () => api<SavedRequest>(`/requests/${suite.requestId}`), retry: false })
  const last = suite.lastRun
  const results = Object.fromEntries((last?.results ?? []).map((r) => [r.id, r])) as Record<string, AssertionResult>
  const byId = Object.fromEntries(suite.assertions.map((a) => [a.id, a]))
  const onError = (e: Error) => toast.error(e.message)
  const refresh = () => qc.invalidateQueries({ queryKey: ['suites'] })

  const save = useMutation({
    mutationFn: () => api<TestSuite>(`/suites/${suite.id}`, { method: 'PATCH', body: { name: name.trim(), assertions: draft } }),
    onSuccess: () => { refresh(); toast.success('Suite saved') },
    onError,
  })
  const run = useMutation({
    mutationFn: async (only?: 'failed') => {
      if (dirty) await api(`/suites/${suite.id}`, { method: 'PATCH', body: { name: name.trim(), assertions: draft } })
      return api(`/suites/${suite.id}/run${only ? '?only=failed' : ''}`, { method: 'POST' })
    },
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['history'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError,
  })
  const remove = useMutation({
    mutationFn: () => api(`/suites/${suite.id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast.success('Suite deleted'); onDeleted() },
    onError,
  })
  const generate = useMutation({
    mutationFn: async () => {
      const page = await api<HistoryPage>(`/history?requestId=${suite.requestId}&limit=1`)
      if (!page.items.length) throw new Error('Run the request or this suite once first, so there is a response to read.')
      const exec = await api<Execution>(`/history/${page.items[0].id}`)
      let body: unknown
      try { body = JSON.parse(exec.responseBody ?? '') } catch { throw new Error('The last response is not JSON.') }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('The last response is not a JSON object.')
      return Object.entries(body).flatMap(([k, v]): Assertion[] => [
        { id: crypto.randomUUID(), kind: 'exists', path: k },
        { id: crypto.randomUUID(), kind: 'type', path: k, expected: jsType(v) },
      ])
    },
    onSuccess: (added) => {
      const have = new Set(draft.map((a) => `${a.kind}|${a.path}`))
      const fresh = added.filter((a) => !have.has(`${a.kind}|${a.path}`))
      setDraft([...draft, ...fresh])
      toast.success(fresh.length ? `Added ${fresh.length} assertions. Review and save.` : 'Nothing new to add')
    },
    onError,
  })

  const reg = last?.regression
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Input className="h-8 max-w-xs font-medium" value={name} onChange={(e) => setName(e.target.value)} aria-label="Suite name" />
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={!dirty || !name.trim() || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save</Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDel(true)}><Trash2 />Delete</Button>
        </div>
      </div>

      <p className="flex items-center gap-2 text-muted-foreground">
        {request.isLoading ? 'Loading request' : request.data ? (<><MethodLabel method={request.data.spec.method} className="w-auto" /><span className="truncate">{request.data.name}</span></>) : 'The saved request for this suite no longer exists.'}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run.mutate(undefined)} disabled={run.isPending || !request.data}>
          {run.isPending && !run.variables ? <Loader2 className="animate-spin" /> : <Play />}Run suite
        </Button>
        <Button size="sm" variant="outline" onClick={() => run.mutate('failed')} disabled={run.isPending || !last || last.failed === 0 || dirty}>
          {run.isPending && run.variables ? <Loader2 className="animate-spin" /> : <Play />}Run failed only
        </Button>
        <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}Generate from response
        </Button>
      </div>

      {last && (
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2', last.failed ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5')}>
          {last.failed ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
          <span className="font-medium">{last.failed ? `${last.failed} failed` : 'All passed'}</span>
          <span className="text-muted-foreground">{last.passed} passed</span>
          <span className="font-mono text-xs text-muted-foreground">{formatMs(last.durationMs)}</span>
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo(last.ranAt)}</span>
        </div>
      )}

      {draft.length === 0 && (
        <p className="text-muted-foreground">No assertions yet. Add one below, or generate them from the last response.</p>
      )}
      <AssertionEditor value={draft} onChange={setDraft} results={dirty ? undefined : results} />

      {reg && (reg.changes.length > 0 || reg.newlyFailing.length > 0) && (
        <section className="space-y-2 rounded-lg border bg-surface p-3">
          <h3 className="font-medium">Regression since the previous run</h3>
          {reg.newlyFailing.length > 0 && (
            <p className="text-destructive">Newly failing: {reg.newlyFailing.map((id) => label(byId[id])).join(', ')}</p>
          )}
          <ul className="space-y-1 font-mono text-xs">
            {reg.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn('w-16 shrink-0', kindColor[c.kind])}>{c.kind}</span>
                <span className="truncate">{c.path}</span>
                <span className="truncate text-muted-foreground">{c.kind === 'added' ? show(c.after) : c.kind === 'removed' ? show(c.before) : `${show(c.before)} to ${show(c.after)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog open={confirmDel} title={`Delete "${suite.name}"?`} description="The suite and its last run results will be permanently removed."
        onConfirm={() => { setConfirmDel(false); remove.mutate() }} onClose={() => setConfirmDel(false)} />
    </div>
  )
}

export default function TestSuites() {
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const suites = useQuery({ queryKey: ['suites'], queryFn: () => api<TestSuite[]>('/suites') })
  const current = suites.data?.find((s) => s.id === selected) ?? suites.data?.[0]
  useEffect(() => { if (selected && suites.data && !current) setSelected(null) }, [selected, suites.data, current])

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Test Suites</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus />New suite</Button>
      </div>

      {suites.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : suites.isError ? (
        <ErrorState message={suites.error.message} onRetry={() => suites.refetch()} />
      ) : !suites.data?.length ? (
        <div className="rounded-lg border bg-surface">
          <EmptyState icon={FlaskConical} title="No test suites yet" description="Pick a saved request and describe what a healthy response looks like. Run the suite any time to catch regressions."
            action={<Button size="sm" onClick={() => setCreating(true)}>Create suite</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <div className="space-y-0.5">
            {suites.data.map((s) => (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent', s.id === current?.id && 'bg-accent text-foreground')}>
                <span className="truncate">{s.name}</span>
                {s.lastRun && <span className={cn('size-2 shrink-0 rounded-full', s.lastRun.failed ? 'bg-destructive' : 'bg-success')} title={s.lastRun.failed ? 'Last run failed' : 'Last run passed'} />}
              </button>
            ))}
          </div>
          {current && <SuiteDetail key={current.id} suite={current} onDeleted={() => setSelected(null)} />}
        </div>
      )}

      <NewSuiteDialog open={creating} onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); setSelected(s.id) }} />
    </div>
  )
}
