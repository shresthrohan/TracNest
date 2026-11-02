import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { RequestBuilder } from '@/components/request/RequestBuilder'
import { ResponseViewer } from '@/components/response/ResponseViewer'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { emptySpec, type Execution, type RequestSpec } from '@/types'

export default function Playground() {
  const [params] = useSearchParams()
  const executionId = params.get('execution')
  const requestId = params.get('request')
  const [spec, setSpec] = useState<RequestSpec>(emptySpec)
  const [result, setResult] = useState<Execution | null>(null)

  // Preload from history (?execution=) or a saved request (?request=).
  useEffect(() => {
    if (!executionId && !requestId) return
    let live = true
    const load = executionId
      ? api<Execution>(`/history/${executionId}`).then((e) => { if (live) { setSpec(e.request); setResult(e) } })
      : api<{ request?: RequestSpec } & Partial<RequestSpec>>(`/requests/${requestId}`).then((r) => {
          if (live) setSpec({ ...emptySpec(), ...(r.request ?? r) })
        })
    load.catch((e: Error) => toast.error(`Could not load request: ${e.message}`))
    return () => { live = false }
  }, [executionId, requestId])

  const send = useMutation({
    mutationFn: () => api<Execution>('/execute', { body: { spec, ...(requestId ? { requestId } : {}) } }),
    onSuccess: setResult,
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-base font-semibold">API Playground</h1>
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
