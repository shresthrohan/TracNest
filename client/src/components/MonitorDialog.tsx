import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { methodColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { emptySpec, METHODS, type Collection, type Method, type Monitor, type SavedRequest } from '@/types'

export const INTERVALS: [number, string][] = [[60, 'Every minute'], [300, 'Every 5 minutes'], [900, 'Every 15 minutes'], [1800, 'Every 30 minutes'], [3600, 'Every hour']]

export function MonitorDialog({ open, onOpenChange, monitor, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; monitor?: Monitor; onSaved?: (m: Monitor) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'saved' | 'manual'>('manual')
  const [method, setMethod] = useState<Method>('GET')
  const [url, setUrl] = useState('')
  const [colId, setColId] = useState('')
  const [reqId, setReqId] = useState('')
  const [interval, setIv] = useState(300)
  const [expected, setExpected] = useState('200')

  const cols = useQuery({ queryKey: ['collections'], queryFn: () => api<Collection[]>('/collections'), enabled: open })
  const reqs = useQuery({ queryKey: ['collection-requests', colId], queryFn: () => api<SavedRequest[]>(`/collections/${colId}/requests`), enabled: open && !!colId })

  useEffect(() => {
    if (!open) return
    setName(monitor?.name ?? ''); setMode('manual'); setColId(''); setReqId('')
    setMethod(monitor?.spec.method ?? 'GET'); setUrl(monitor?.spec.url ?? '')
    setIv(monitor?.intervalSec ?? 300); setExpected(String(monitor?.expectedStatus ?? 200))
  }, [open, monitor])

  const picked = reqs.data?.find((r) => r.id === reqId)
  const spec = mode === 'saved' ? picked?.spec : { ...(monitor?.spec ?? emptySpec()), method, url: url.trim() }
  const code = Number(expected)
  const valid = name.trim() && spec?.url && Number.isInteger(code) && code >= 100 && code <= 599

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), spec, intervalSec: interval, expectedStatus: code }
      return monitor ? api<Monitor>(`/monitors/${monitor.id}`, { method: 'PATCH', body }) : api<Monitor>('/monitors', { body })
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-stats'] })
      toast.success(monitor ? 'Monitor updated' : 'Monitor created')
      onOpenChange(false)
      onSaved?.(m)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{monitor ? 'Edit monitor' : 'New monitor'}</DialogTitle>
          <DialogDescription>Sends the request on a schedule and records whether it returns the expected status.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate() }}>
          <div className="space-y-1.5"><Label htmlFor="mon-name">Name</Label><Input id="mon-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production health check" autoFocus /></div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'saved' | 'manual')}>
            <TabsList variant="line"><TabsTrigger value="manual">Method and URL</TabsTrigger><TabsTrigger value="saved">Saved request</TabsTrigger></TabsList>
          </Tabs>
          {mode === 'manual' ? (
            <div className="flex gap-2">
              <Select value={method} onValueChange={(m) => setMethod(m as Method)}>
                <SelectTrigger className={cn('w-28 font-mono text-xs font-semibold', methodColor[method])} aria-label="Method"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className={cn('font-mono text-xs font-semibold', methodColor[m])}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/health" className="font-mono text-xs" aria-label="URL" />
            </div>
          ) : cols.data?.length === 0 ? (
            <p className="text-muted-foreground">Save a request to a collection from the Playground first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Select value={colId} onValueChange={(v) => { setColId(v); setReqId('') }}>
                <SelectTrigger className="w-full" aria-label="Collection"><SelectValue placeholder={cols.isLoading ? 'Loading' : 'Collection'} /></SelectTrigger>
                <SelectContent>{cols.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={reqId} onValueChange={setReqId} disabled={!colId}>
                <SelectTrigger className="w-full" aria-label="Request"><SelectValue placeholder={reqs.data && !reqs.data.length ? 'No requests' : 'Request'} /></SelectTrigger>
                <SelectContent>{reqs.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Check</Label>
              <Select value={String(interval)} onValueChange={(v) => setIv(Number(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVALS.map(([s, l]) => <SelectItem key={s} value={String(s)}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="mon-exp">Expected status</Label><Input id="mon-exp" inputMode="numeric" value={expected} onChange={(e) => setExpected(e.target.value)} className="font-mono" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{save.isPending && <Loader2 className="animate-spin" />}{monitor ? 'Save changes' : 'Create monitor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
