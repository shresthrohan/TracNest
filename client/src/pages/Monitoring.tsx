import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Loader2, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatMs, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MethodLabel } from '@/components/StatusBadge'
import { INTERVALS, MonitorDialog } from '@/components/MonitorDialog'
import type { Monitor, MonitorCheck, MonitorStats } from '@/types'

const POLL = 15_000
const dot = { up: 'bg-success', down: 'bg-destructive', pending: 'bg-muted-foreground' }
const pct = (v: number | null) => (v === null ? '-' : `${Math.round(v * 10) / 10}%`)
const ivLabel = (s: number) => INTERVALS.find(([v]) => v === s)?.[1] ?? `Every ${s}s`
const fmtT = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const useStats = (id: string, enabled = true) =>
  useQuery({ queryKey: ['monitor-stats', id], queryFn: () => api<MonitorStats>(`/monitors/${id}/stats?hours=24`), refetchInterval: POLL, enabled })

function Status({ m }: { m: Monitor }) {
  return <span className={cn('size-2 shrink-0 rounded-full', m.active ? dot[m.currentStatus] : 'border border-muted-foreground')} />
}

function Sparkline({ id }: { id: string }) {
  const { data } = useStats(id)
  if (!data || data.series.length < 2) return <span className="h-6 w-16" />
  return (
    <div className="h-6 w-16" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.series} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
          <Line type="monotone" dataKey="responseTime" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Row({ m, selected, onSelect }: { m: Monitor; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button onClick={onSelect} className={cn('flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent/50', selected && 'bg-accent')}>
        <span className="flex items-center gap-2">
          <Status m={m} />
          <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
          {!m.active && <span className="text-xs text-muted-foreground">Paused</span>}
        </span>
        <span className="flex items-center gap-2 pl-4">
          <MethodLabel method={m.spec.method} />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{m.spec.url}</span>
        </span>
        <span className="flex items-center justify-between gap-2 pl-4 text-xs text-muted-foreground">
          {m.lastCheckedAt ? (
            <>
              <span className="font-mono tabular-nums">{pct(m.uptime24h)} up</span>
              <span className="font-mono tabular-nums">{m.avgMs24h === null ? '-' : formatMs(m.avgMs24h)}</span>
              <Sparkline id={m.id} />
            </>
          ) : <span>Waiting for first check</span>}
        </span>
      </button>
    </li>
  )
}

function ChartDot(p: { cx?: number; cy?: number; payload?: MonitorCheck }) {
  const { cx, cy, payload } = p
  if (cx === undefined || cy === undefined || !payload || (payload.ok && !payload.anomaly)) return <g />
  return <circle cx={cx} cy={cy} r={4} fill={payload.ok ? 'var(--warning)' : 'var(--destructive)'} stroke="var(--surface)" strokeWidth={2} />
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border bg-surface px-4 py-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
  </div>
)

function Detail({ m, onEdit, onDelete }: { m: Monitor; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient()
  const stats = useStats(m.id, !!m.lastCheckedAt)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['monitors'] }); qc.invalidateQueries({ queryKey: ['monitor-stats', m.id] }) }
  const check = useMutation({
    mutationFn: () => api<MonitorCheck>(`/monitors/${m.id}/check`, { method: 'POST' }),
    onSuccess: (c) => {
      refresh()
      if (c.ok) toast.success(`Check passed in ${formatMs(c.responseTime)}`)
      else toast.error(`Check failed: ${c.error?.message ?? `status ${c.statusCode}`}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const toggle = useMutation({
    mutationFn: () => api<Monitor>(`/monitors/${m.id}`, { method: 'PATCH', body: { active: !m.active } }),
    onSuccess: () => { refresh(); toast.success(m.active ? 'Monitor paused' : 'Monitor resumed') },
    onError: (e: Error) => toast.error(e.message),
  })
  const s = stats.data
  const failed = (s?.series ?? []).filter((c) => !c.ok).slice(-20).reverse()

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Status m={m} />{m.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MethodLabel method={m.spec.method} /><span className="truncate font-mono">{m.spec.url}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{ivLabel(m.intervalSec)}, expects {m.expectedStatus}{!m.active && ', paused'}</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => check.mutate()} disabled={check.isPending}>{check.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}Check now</Button>
          <Button size="sm" variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending}>{m.active ? <Pause /> : <Play />}{m.active ? 'Pause' : 'Resume'}</Button>
          <Button size="icon-sm" variant="outline" onClick={onEdit} aria-label="Edit monitor"><Pencil /></Button>
          <Button size="icon-sm" variant="outline" onClick={onDelete} aria-label="Delete monitor"><Trash2 /></Button>
        </div>
      </div>

      {!m.lastCheckedAt ? (
        <div className="rounded-lg border bg-surface">
          <EmptyState icon={Activity} title="Waiting for first check" description={m.active ? 'The first check runs shortly. Use Check now to run it immediately.' : 'This monitor is paused. Resume it, or use Check now to record a check.'} />
        </div>
      ) : stats.isLoading ? <Skeleton className="h-72" /> : stats.isError ? (
        <div className="rounded-lg border bg-surface"><ErrorState message={stats.error.message} onRetry={() => stats.refetch()} /></div>
      ) : s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Uptime, 24 h" value={pct(s.uptime)} />
            <Stat label="Avg response time" value={s.avgMs === null ? '-' : formatMs(s.avgMs)} />
            <Stat label="Checks" value={String(s.total)} />
            <Stat label="Failed" value={String(s.failed)} />
          </div>
          <section className="overflow-hidden rounded-lg border bg-surface">
            <div className="flex items-center justify-between border-b px-4 py-2.5 text-xs text-muted-foreground">
              <h3 className="font-medium">Response time, last 24 hours</h3>
              <span className="flex gap-3">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Anomaly</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" />Failed</span>
              </span>
            </div>
            <div className="h-64 px-2 pb-2 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.series} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="checkedAt" tickFormatter={fmtT} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} minTickGap={40} />
                  <YAxis tickFormatter={(v: number) => formatMs(v)} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} width={56} />
                  <Tooltip
                    cursor={{ stroke: 'oklch(1 0 0 / 15%)' }}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(t) => new Date(String(t)).toLocaleString()}
                    formatter={(v, _n, item) => {
                      const c = item.payload as MonitorCheck
                      return [`${formatMs(Number(v))}${c.ok ? '' : ` (failed: ${c.error?.code ?? c.statusCode})`}${c.anomaly ? ' (anomaly)' : ''}`, 'Response']
                    }}
                  />
                  <Line type="monotone" dataKey="responseTime" stroke="var(--chart-1)" strokeWidth={1.75} dot={<ChartDot />} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="overflow-hidden rounded-lg border bg-surface">
            <h3 className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">Failed checks</h3>
            {failed.length === 0 ? <p className="px-4 py-8 text-center text-muted-foreground">No failed checks in the last 24 hours.</p> : (
              <ul className="divide-y">
                {failed.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span className="w-16 text-muted-foreground" title={new Date(c.checkedAt).toLocaleString()}>{timeAgo(c.checkedAt)}</span>
                    <span className="font-mono text-destructive">{c.error?.code ?? c.statusCode ?? 'ERR'}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.error?.message ?? `Expected ${m.expectedStatus}, got ${c.statusCode}`}</span>
                    <span className="font-mono text-muted-foreground">{formatMs(c.responseTime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default function Monitoring() {
  const qc = useQueryClient()
  const [sel, setSel] = useState<string>()
  const [dialog, setDialog] = useState<{ monitor?: Monitor } | null>(null)
  const [del, setDel] = useState(false)
  const list = useQuery({ queryKey: ['monitors'], queryFn: () => api<Monitor[]>('/monitors'), refetchInterval: POLL })
  const current = list.data?.find((m) => m.id === sel) ?? list.data?.[0]
  const remove = useMutation({
    mutationFn: (id: string) => api(`/monitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monitors'] }); setSel(undefined); toast.success('Monitor deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
  const newBtn = <Button size="sm" onClick={() => setDialog({})}><Plus />New monitor</Button>

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-6">
        <h1 className="text-base font-semibold">Monitoring</h1>
        {list.data && list.data.length > 0 && newBtn}
      </div>
      {list.isLoading ? (
        <div className="space-y-2 p-6">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      : !list.data?.length ? (
        <EmptyState icon={Activity} title="No monitors yet" description="Monitor an endpoint on a schedule to track uptime and response time, and flag unusually slow responses." action={newBtn} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ul className="max-h-64 shrink-0 divide-y overflow-y-auto border-b md:max-h-none md:w-80 md:border-b-0 md:border-r">
            {list.data.map((m) => <Row key={m.id} m={m} selected={m.id === current?.id} onSelect={() => setSel(m.id)} />)}
          </ul>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {current && <Detail key={current.id} m={current} onEdit={() => setDialog({ monitor: current })} onDelete={() => setDel(true)} />}
          </div>
        </div>
      )}
      <MonitorDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} monitor={dialog?.monitor} onSaved={(m) => setSel(m.id)} />
      <ConfirmDialog open={del} title="Delete monitor?" description={`"${current?.name}" and its check history will be permanently deleted.`} onClose={() => setDel(false)} onConfirm={() => { setDel(false); if (current) remove.mutate(current.id) }} />
    </div>
  )
}
