import { Ban } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonEditor } from '@/components/JsonEditor'
import { StatusBadge } from '@/components/StatusBadge'
import { formatBytes, formatMs, parseCookies, prettyBody } from '@/lib/format'
import type { Execution } from '@/types'

const lc = (h?: Record<string, string | string[]>) => h ?? {}
const cell = 'border-b px-3 py-1.5 align-top font-mono text-xs'

export function ResponseViewer({ execution: ex }: { execution: Execution }) {
  const headers = Object.entries(lc(ex.responseHeaders))
  const cookies = parseCookies(Object.entries(lc(ex.responseHeaders)).find(([k]) => k.toLowerCase() === 'set-cookie')?.[1])
  const body = ex.responseBody ?? ''
  const pretty = prettyBody(body)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <StatusBadge code={ex.statusCode} error={ex.error?.code} />
        <span className="font-mono text-xs text-muted-foreground">{formatMs(ex.responseTime)}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatBytes(ex.responseSize)}</span>
      </div>

      {ex.error && (
        <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/8 p-3 text-xs">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div><p className="font-medium text-destructive">{ex.error.code.replace(/_/g, ' ')}</p><p className="mt-0.5 text-muted-foreground">{ex.error.message}</p></div>
        </div>
      )}

      <Tabs defaultValue="body">
        <TabsList variant="line">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">Headers<span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{headers.length}</span></TabsTrigger>
          <TabsTrigger value="cookies">Cookies{cookies.length > 0 && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{cookies.length}</span>}</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="pt-3">
          {!body ? (
            <p className="py-6 text-center text-muted-foreground">{ex.error ? 'No response was received.' : 'The response has no body.'}</p>
          ) : pretty ? (
            <div className="max-h-[480px] overflow-auto rounded-md border"><JsonEditor value={pretty} readOnly minHeight="80px" /></div>
          ) : (
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-surface p-3 font-mono text-xs">{body}</pre>
          )}
        </TabsContent>

        <TabsContent value="headers" className="pt-3">
          {headers.length === 0 ? <p className="py-6 text-center text-muted-foreground">No response headers.</p> : (
            <KeyTable rows={headers.map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : v])} />
          )}
        </TabsContent>

        <TabsContent value="cookies" className="pt-3">
          {cookies.length === 0 ? <p className="py-6 text-center text-muted-foreground">This response did not set any cookies.</p> : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-left">
                <thead><tr className="bg-surface text-xs text-muted-foreground"><th className="px-3 py-1.5 font-medium">Name</th><th className="px-3 py-1.5 font-medium">Value</th><th className="px-3 py-1.5 font-medium">Attributes</th></tr></thead>
                <tbody>{cookies.map((c, i) => (
                  <tr key={i}><td className={cell}>{c.name}</td><td className={`${cell} break-all`}>{c.value}</td><td className={`${cell} break-all text-muted-foreground`}>{c.attrs}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="pt-3">
          <KeyTable rows={[
            ['Method', ex.request.method],
            ['Requested URL', ex.request.url],
            ...(ex.finalUrl ? [['Final URL', ex.finalUrl]] : []),
            ['Redirects', ex.redirects?.length ? ex.redirects.join('\n') : 'None'],
            ['Size', formatBytes(ex.responseSize)],
            ['Time', formatMs(ex.responseTime)],
            ['Error', ex.error ? `${ex.error.code}: ${ex.error.message}` : 'None'],
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KeyTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-left">
        <tbody>{rows.map(([k, v]) => (
          <tr key={k}><td className={`${cell} w-48 text-muted-foreground`}>{k}</td><td className={`${cell} whitespace-pre-wrap break-all`}>{v}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
