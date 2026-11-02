import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LayoutDashboard } from 'lucide-react'
import { api } from '@/lib/api'
import { formatMs, timeAgo } from '@/lib/format'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { MethodLabel, StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Dashboard as DashboardData } from '@/types'

const RANGES = [['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days']]

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-surface">
      <h2 className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

const Tile = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="rounded-lg border bg-surface px-4 py-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
  </div>
)

export default function Dashboard() {
  const [days, setDays] = useState('7')
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', days],
    queryFn: () => api<DashboardData>(`/dashboard?days=${days}`),
  })
  const hourly = days === '1'
  const fmtBucket = (b: string) => {
    const d = new Date(b)
    return hourly ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Dashboard</h1>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border bg-surface"><ErrorState message={error.message} onRetry={() => refetch()} /></div>
      ) : !data || data.total === 0 ? (
        <div className="rounded-lg border bg-surface">
          <EmptyState
            icon={LayoutDashboard}
            title="No requests in this period"
            description="Send a request from the Playground and its results will be summarised here."
            action={<Button size="sm" asChild><Link to="/playground">Send your first request</Link></Button>}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Total requests" value={String(data.total)} />
            <Tile label="Success rate" value={`${Math.round(data.successRate)}%`} tone={data.successRate >= 90 ? 'text-success' : data.successRate >= 60 ? 'text-warning' : 'text-destructive'} />
            <Tile label="Failed" value={String(data.failed)} tone={data.failed ? 'text-destructive' : undefined} />
            <Tile label="Avg response time" value={formatMs(data.avgMs)} />
          </div>

          <Panel title="Average response time">
            <div className="h-60 px-2 pb-2 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="avg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="bucket" tickFormatter={fmtBucket} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} minTickGap={32} />
                  <YAxis tickFormatter={(v: number) => formatMs(v)} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} width={56} />
                  <Tooltip
                    cursor={{ stroke: 'oklch(1 0 0 / 15%)' }}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(b) => fmtBucket(String(b))}
                    formatter={(v, _n, item) => [`${formatMs(Number(v))} (${item.payload.count} req, ${item.payload.failed} failed)`, 'Avg']}
                  />
                  <Area type="monotone" dataKey="avgMs" stroke="var(--chart-1)" strokeWidth={1.75} fill="url(#avg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recent requests">
              <ul className="divide-y">
                {data.recent.map((e) => (
                  <li key={e.id}>
                    <Link to={`/playground?execution=${e.id}`} className="flex items-center gap-2 px-4 py-2 hover:bg-accent/50">
                      <MethodLabel method={e.request.method} />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs" title={e.request.url}>{e.request.url}</span>
                      <StatusBadge code={e.statusCode} error={e.error?.code} />
                      <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(e.executedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Most failing endpoints">
              {data.failing.length === 0 ? (
                <p className="px-4 py-8 text-center text-muted-foreground">No failures in this period.</p>
              ) : (
                <ul className="divide-y">
                  {data.failing.map((f) => (
                    <li key={`${f.method} ${f.url}`} className="flex items-center gap-2 px-4 py-2">
                      <MethodLabel method={f.method} />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.url}>{f.url}</span>
                      <span className="font-mono text-xs text-destructive">{f.failures}x</span>
                      <StatusBadge code={f.lastStatus} error="ERR" />
                      <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(f.lastAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
