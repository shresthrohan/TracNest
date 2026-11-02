import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AiExplanation, Execution, TestSuite } from '@/types'

export const useAiEnabled = () =>
  useQuery({ queryKey: ['ai-status'], queryFn: () => api<{ enabled: boolean }>('/ai/status'), staleTime: 60_000 }).data?.enabled === true

const List = ({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) => items.length > 0 && (
  <div>
    <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
    {ordered
      ? <ol className="list-decimal space-y-0.5 pl-5">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>
      : <ul className="list-disc space-y-0.5 pl-5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>}
  </div>
)

export function AiPanel({ execution: ex }: { execution: Execution }) {
  const qc = useQueryClient()
  const [suiteId, setSuiteId] = useState('')
  const explain = useMutation({ mutationFn: () => api<AiExplanation>('/ai/explain', { body: { executionId: ex.id } }) })
  const suites = useQuery({
    queryKey: ['suites', 'by-request', ex.requestId],
    queryFn: () => api<TestSuite[]>(`/suites?requestId=${ex.requestId}`),
    enabled: !!ex.requestId && !!explain.data?.assertions.length,
  })
  const target = suites.data?.find((s) => s.id === suiteId)
  const add = useMutation({
    mutationFn: () => api<TestSuite>(`/suites/${suiteId}`, {
      method: 'PATCH',
      body: { assertions: [...target!.assertions, ...explain.data!.assertions.map((a) => ({ ...a, id: crypto.randomUUID() }))] },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suites'] })
      toast.success(`Added ${explain.data!.assertions.length} assertions to ${target!.name}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const r = explain.data

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => explain.mutate()} disabled={explain.isPending}>
        {explain.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}{r ? 'Explain again' : 'Explain with AI'}
      </Button>
      {explain.isError && <p role="alert" className="text-xs text-destructive">{explain.error.message}</p>}
      {r && (
        <div className="space-y-3 rounded-md border bg-surface p-3 text-xs leading-relaxed">
          <p className="text-sm">{r.explanation}</p>
          <List title="Likely causes" items={r.causes} />
          <List title="Next steps" items={r.steps} ordered />
          {r.assertions.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-muted-foreground">{r.assertions.length} suggested assertion{r.assertions.length > 1 ? 's' : ''}</p>
              <ul className="space-y-0.5 font-mono">{r.assertions.map((a, i) => <li key={i}>{a.kind}{a.path ? ` ${a.path}` : ''}{a.expected !== undefined ? ` ${JSON.stringify(a.expected)}` : ''}</li>)}</ul>
              {!ex.requestId ? (
                <p className="text-muted-foreground">Save this request to a collection and create a test suite to add assertions.</p>
              ) : suites.isLoading ? <Loader2 className="size-4 animate-spin" /> : !suites.data?.length ? (
                <p className="text-muted-foreground">This request has no test suite yet. Create one in Test Suites first.</p>
              ) : (
                <div className="flex gap-2">
                  <Select value={suiteId} onValueChange={setSuiteId}>
                    <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Choose a suite" /></SelectTrigger>
                    <SelectContent>{suites.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => add.mutate()} disabled={!suiteId || add.isPending}>{add.isPending && <Loader2 className="animate-spin" />}Add assertions to suite</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
