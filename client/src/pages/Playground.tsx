import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Rocket, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { RequestBuilder } from '@/components/request/RequestBuilder'
import { ResponseViewer } from '@/components/response/ResponseViewer'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { SaveRequestDialog } from '@/components/SaveRequestDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { emptySpec, type Execution, type RequestSpec, type SavedRequest } from '@/types'

export default function Playground() {
  const [params, setParams] = useSearchParams()
  const executionId = params.get('execution')
  const requestId = params.get('request')
  const [spec, setSpec] = useState<RequestSpec>(emptySpec)
  const [result, setResult] = useState<Execution | null>(null)
  const [savedName, setSavedName] = useState('')
  const [saveAs, setSaveAs] = useState(false)
  const qc = useQueryClient()

  // Preload from history (?execution=) or a saved request (?request=).
  useEffect(() => {
    if (!executionId && !requestId) return
    let live = true
    const load = executionId
      ? api<Execution>(`/history/${executionId}`).then((e) => { if (live) { setSpec(e.request); setResult(e) } })
      : api<SavedRequest>(`/requests/${requestId}`).then((r) => {
          if (live) { setSpec({ ...emptySpec(), ...r.spec }); setSavedName(r.name) }
        })
    load.catch((e: Error) => toast.error(`Could not load request: ${e.message}`))
    return () => { live = false }
  }, [executionId, requestId])

  const send = useMutation({
    mutationFn: () => api<Execution>('/execute', { body: { spec, ...(requestId ? { requestId } : {}) } }),
    onSuccess: setResult,
    onError: (e: Error) => toast.error(e.message),
  })

  const save = useMutation({
    mutationFn: () => api<SavedRequest>(`/requests/${requestId}`, { method: 'PATCH', body: { spec } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-requests'] })
      toast.success('Request saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-base font-semibold">API Playground{requestId && savedName && <span className="ml-2 font-normal text-muted-foreground">{savedName}</span>}</h1>
        <div className="flex gap-2">
          {requestId && (
            <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSaveAs(true)} disabled={!spec.url.trim()}>{requestId ? 'Save as' : 'Save'}</Button>
        </div>
      </div>
      <SaveRequestDialog
        open={saveAs}
        onOpenChange={setSaveAs}
        spec={spec}
        defaultName={requestId && savedName ? `${savedName} (copy)` : spec.url.replace(/^https?:\/\//, '').slice(0, 60)}
        onSaved={(r) => { setSavedName(r.name); setParams({ request: r.id }, { replace: true }) }}
      />
      <RequestBuilder value={spec} onChange={setSpec} onSend={() => send.mutate()} sending={send.isPending} />
      <div className="border-t pt-4">
        {send.isPending ? (
          <div className="space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-40 w-full" /></div>
        ) : result ? (
          <ResponseViewer execution={result} />
        ) : (
          <EmptyState icon={Rocket} title="Send a request to see the response" description="Enter a URL and press Send, or use Ctrl+Enter. Every request is saved to your history." />
        )}
      </div>
    </div>
  )
}
