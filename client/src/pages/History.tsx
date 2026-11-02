import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, History as HistoryIcon, Loader2, Play, Search, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatBytes, formatMs, timeAgo } from '@/lib/format'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MethodLabel, StatusBadge } from '@/components/StatusBadge'
import { ResponseViewer } from '@/components/response/ResponseViewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { METHODS, type Execution, type HistoryPage } from '@/types'

const LIMIT = 20
const ALL = 'all'

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

export default function History() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [method, setMethod] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const dq = useDebounced(q, 300)

  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
  if (dq.trim()) qs.set('q', dq.trim())
  if (method !== ALL) qs.set('method', method)
  if (status !== ALL) qs.set('status', status)

  const list = useQuery({ queryKey: ['history', qs.toString()], queryFn: () => api<HistoryPage>(`/history?${qs}`), placeholderData: keepPreviousData })
  const detail = useQuery({ queryKey: ['history-item', openId], queryFn: () => api<Execution>(`/history/${openId}`), enabled: !!openId })

  const rerun = useMutation({
    mutationFn: (id: string) => api<Execution>(`/history/${id}/rerun`, { method: 'POST' }),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.setQueryData(['history-item', e.id], e)
      setOpenId(e.id)
      toast.success('Request re-run')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({
    mutationFn: (id: string) => api(`/history/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (openId === id) setOpenId(null)
      toast.success('Entry deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = !!dq.trim() || method !== ALL || status !== ALL
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  const data = list.data

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-base font-semibold">Request History</h1>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input className="h-8 pl-8" placeholder="Search by URL" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        </div>
        <Select value={method} onValueChange={reset(setMethod)}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All methods</SelectItem>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={reset(setStatus)}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {['2xx', '3xx', '4xx', '5xx'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            <SelectItem value="error">Failed to connect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-surface">
        {list.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : list.isError ? (
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title={filtered ? 'No matching requests' : 'No requests yet'}
            description={filtered ? 'Try a different search or clear the filters.' : 'Requests you send from the Playground show up here.'}
            action={!filtered && <Button size="sm" onClick={() => nav('/playground')}>Open Playground</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Method</TableHead><TableHead>URL</TableHead><TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Time</TableHead><TableHead className="w-24 text-right">Size</TableHead><TableHead className="w-28 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={list.isPlaceholderData ? 'opacity-60' : undefined}>
              {data.items.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpenId(e.id)}>
                  <TableCell><MethodLabel method={e.request.method} /></TableCell>
                  <TableCell className="max-w-0 truncate font-mono text-xs" title={e.request.url}>{e.request.url}</TableCell>
                  <TableCell><StatusBadge code={e.statusCode} error={e.error?.code} /></TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatMs(e.responseTime)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatBytes(e.responseSize)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(e.executedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{data.total} requests</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="font-mono text-xs">{data.page} / {data.pages}</span>
            <Button variant="outline" size="icon-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Request details</SheetTitle>
            <SheetDescription className="break-all font-mono text-xs">
              {detail.data ? `${detail.data.request.method} ${detail.data.request.url}` : 'Loading'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {detail.isLoading && <Skeleton className="h-48 w-full" />}
            {detail.isError && <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />}
            {detail.data && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => rerun.mutate(detail.data.id)} disabled={rerun.isPending}>
                    {rerun.isPending ? <Loader2 className="animate-spin" /> : <Play />}Rerun
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => nav(`/playground?execution=${detail.data.id}`)}><SquareArrowOutUpRight />Open in Playground</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(detail.data.id)}><Trash2 />Delete</Button>
                </div>
                <ResponseViewer execution={detail.data} />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this history entry?</AlertDialogTitle>
            <AlertDialogDescription>The request and its stored response will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && del.mutate(deleting)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
