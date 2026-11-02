import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Copy, FolderOpen, FolderPlus, Loader2, Pencil, Play, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MethodLabel } from '@/components/StatusBadge'
import { ResponseViewer } from '@/components/response/ResponseViewer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { Collection, Execution, SavedRequest } from '@/types'

type Editing = { id?: string; name: string; description: string } | null

export default function Collections() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [delCol, setDelCol] = useState<Collection | null>(null)
  const [delReq, setDelReq] = useState<SavedRequest | null>(null)
  const [ran, setRan] = useState<{ req: SavedRequest; exec: Execution } | null>(null)

  const cols = useQuery({ queryKey: ['collections'], queryFn: () => api<Collection[]>('/collections') })
  const current = cols.data?.find((c) => c.id === selected) ?? cols.data?.[0]
  const reqs = useQuery({
    queryKey: ['collection-requests', current?.id],
    queryFn: () => api<SavedRequest[]>(`/collections/${current!.id}/requests`),
    enabled: !!current,
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['collections'] })
    qc.invalidateQueries({ queryKey: ['collection-requests'] })
  }
  const onError = (e: Error) => toast.error(e.message)

  const saveCol = useMutation({
    mutationFn: (v: NonNullable<Editing>) => {
      const body = { name: v.name.trim(), description: v.description.trim() }
      return v.id ? api<Collection>(`/collections/${v.id}`, { method: 'PATCH', body }) : api<Collection>('/collections', { body })
    },
    onSuccess: (c, v) => {
      refresh()
      setEditing(null)
      if (!v.id) setSelected(c.id)
      toast.success(v.id ? 'Collection renamed' : 'Collection created')
    },
    onError,
  })
  const removeCol = useMutation({
    mutationFn: (id: string) => api(`/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); setSelected(null); toast.success('Collection deleted') },
    onError,
  })
  const removeReq = useMutation({
    mutationFn: (id: string) => api(`/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast.success('Request deleted') },
    onError,
  })
  const duplicate = useMutation({
    mutationFn: (id: string) => api<SavedRequest>(`/requests/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => { refresh(); toast.success('Request duplicated') },
    onError,
  })
  const move = useMutation({
    mutationFn: ({ i, d }: { i: number; d: number }) => {
      const ids = reqs.data!.map((r) => r.id)
      const t = ids[i]
      ids[i] = ids[i + d]
      ids[i + d] = t
      return api(`/collections/${current!.id}/reorder`, { body: { ids } })
    },
    onSuccess: refresh,
    onError,
  })
  const run = useMutation({
    mutationFn: (r: SavedRequest) => api<Execution>('/execute', { body: { spec: r.spec, requestId: r.id } }).then((exec) => ({ req: r, exec })),
    onSuccess: (v) => {
      setRan(v)
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError,
  })

  const newCol = () => setEditing({ name: '', description: '' })

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Collections</h1>
        <Button size="sm" onClick={newCol}><FolderPlus />New collection</Button>
      </div>

      {cols.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : cols.isError ? (
        <ErrorState message={cols.error.message} onRetry={() => cols.refetch()} />
      ) : !cols.data?.length ? (
        <div className="rounded-lg border bg-surface">
          <EmptyState icon={FolderOpen} title="No collections yet" description="Collections group the requests you save from the Playground."
            action={<Button size="sm" onClick={newCol}>Create collection</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <div className="space-y-0.5">
            {cols.data.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent',
                  c.id === current?.id && 'bg-accent text-foreground')}>
                <span className="truncate">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.requestCount}</span>
              </button>
            ))}
          </div>

          {current && (
            <div className="min-w-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{current.name}</p>
                  {current.description && <p className="text-muted-foreground">{current.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: current.id, name: current.name, description: current.description ?? '' })}><Pencil />Rename</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDelCol(current)}><Trash2 />Delete</Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border bg-surface">
                {reqs.isLoading ? (
                  <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : reqs.isError ? (
                  <ErrorState message={reqs.error.message} onRetry={() => reqs.refetch()} />
                ) : !reqs.data?.length ? (
                  <EmptyState icon={FolderOpen} title="No requests in this collection" description="Build a request in the Playground and use Save to add it here."
                    action={<Button size="sm" onClick={() => nav('/playground')}>Open Playground</Button>} />
                ) : (
                  <ul className="divide-y">
                    {reqs.data.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                        <MethodLabel method={r.spec.method} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{r.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground" title={r.spec.url}>{r.spec.url}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button size="icon-sm" variant="ghost" aria-label="Run" title="Run" disabled={run.isPending} onClick={() => run.mutate(r)}>
                            {run.isPending && run.variables?.id === r.id ? <Loader2 className="animate-spin" /> : <Play />}
                          </Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Open in Playground" title="Open in Playground" onClick={() => nav(`/playground?request=${r.id}`)}><SquareArrowOutUpRight /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Duplicate" title="Duplicate" onClick={() => duplicate.mutate(r.id)}><Copy /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Move up" title="Move up" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ i, d: -1 })}><ArrowUp /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Move down" title="Move down" disabled={i === reqs.data.length - 1 || move.isPending} onClick={() => move.mutate({ i, d: 1 })}><ArrowDown /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Delete" title="Delete" className="text-destructive hover:text-destructive" onClick={() => setDelReq(r)}><Trash2 /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Rename collection' : 'New collection'}</DialogTitle></DialogHeader>
          {editing && (
            <form id="col-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (editing.name.trim()) saveCol.mutate(editing) }}>
              <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="c-desc">Description</Label><Input id="c-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="col-form" disabled={!editing?.name.trim() || saveCol.isPending}>{saveCol.isPending && <Loader2 className="animate-spin" />}{editing?.id ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!delCol} title={`Delete "${delCol?.name}"?`} description="The collection and all requests in it will be permanently removed. Test suites on those requests stop working."
        onConfirm={() => { if (delCol) removeCol.mutate(delCol.id); setDelCol(null) }} onClose={() => setDelCol(null)} />
      <ConfirmDialog open={!!delReq} title={`Delete "${delReq?.name}"?`} description="The saved request will be permanently removed."
        onConfirm={() => { if (delReq) removeReq.mutate(delReq.id); setDelReq(null) }} onClose={() => setDelReq(null)} />

      <Sheet open={!!ran} onOpenChange={(o) => !o && setRan(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{ran?.req.name}</SheetTitle>
            <SheetDescription className="break-all font-mono text-xs">{ran && `${ran.req.spec.method} ${ran.req.spec.url}`}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{ran && <ResponseViewer execution={ran.exec} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
