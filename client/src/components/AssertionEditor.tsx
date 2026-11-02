import { useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Assertion, AssertionKind, AssertionResult } from '@/types'

const KINDS: { value: AssertionKind; label: string }[] = [
  { value: 'status', label: 'Status code' },
  { value: 'maxTime', label: 'Max time (ms)' },
  { value: 'exists', label: 'Field exists' },
  { value: 'equals', label: 'Field equals' },
  { value: 'type', label: 'Field type' },
  { value: 'contains', label: 'Body contains' },
]
const TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null']
const hasPath = (k: AssertionKind) => k === 'exists' || k === 'equals' || k === 'type'

/** Equals values are edited as JSON; text that is not valid JSON is kept as a plain string. */
const toText = (v: unknown) => (v === undefined ? '' : JSON.stringify(v))
const fromText = (t: string) => { try { return JSON.parse(t) } catch { return t } }

function ExpectedInput({ a, onChange }: { a: Assertion; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => (a.kind === 'equals' ? toText(a.expected) : String(a.expected ?? '')))
  if (a.kind === 'exists') return <span className="px-2 text-xs text-muted-foreground">any value</span>
  if (a.kind === 'type') {
    return (
      <Select value={typeof a.expected === 'string' ? a.expected : undefined} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  const numeric = a.kind === 'status' || a.kind === 'maxTime'
  return (
    <Input
      className="h-8 font-mono text-xs"
      type={numeric ? 'number' : 'text'}
      placeholder={a.kind === 'equals' ? 'JSON value, e.g. "ok" or 42' : a.kind === 'contains' ? 'Text to find' : 'Number'}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(numeric ? (e.target.value === '' ? undefined : Number(e.target.value)) : a.kind === 'equals' ? fromText(e.target.value) : e.target.value)
      }}
    />
  )
}

export function AssertionEditor({ value, onChange, results }: {
  value: Assertion[]; onChange: (v: Assertion[]) => void; results?: Record<string, AssertionResult>
}) {
  const patch = (id: string, p: Partial<Assertion>) => onChange(value.map((a) => (a.id === id ? { ...a, ...p } : a)))
  return (
    <div className="space-y-2">
      {value.map((a) => {
        const r = results?.[a.id]
        return (
          <div key={a.id} className="space-y-1">
            <div className="grid grid-cols-[1.75rem_9.5rem_1fr_1fr_2rem] items-center gap-2">
              <span className="flex justify-center" title={r ? r.message : 'Not run yet'}>
                {r ? (r.passed ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />) : <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
              </span>
              <Select value={a.kind} onValueChange={(k: AssertionKind) => onChange(value.map((x) => (x.id === a.id ? { id: a.id, kind: k, path: hasPath(k) ? x.path : undefined } : x)))}>
                <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
              {hasPath(a.kind)
                ? <Input className="h-8 font-mono text-xs" placeholder="user.items[0].id" value={a.path ?? ''} onChange={(e) => patch(a.id, { path: e.target.value })} />
                : <span />}
              {/* key forces the local text state to reset when the kind changes */}
              <ExpectedInput key={a.kind} a={a} onChange={(v) => patch(a.id, { expected: v })} />
              <Button size="icon-sm" variant="ghost" aria-label="Remove assertion" onClick={() => onChange(value.filter((x) => x.id !== a.id))}><Trash2 /></Button>
            </div>
            {r && !r.passed && <p className="pl-9 text-xs text-destructive">{r.message}</p>}
          </div>
        )
      })}
      <Button size="sm" variant="outline" onClick={() => onChange([...value, { id: crypto.randomUUID(), kind: 'status', expected: 200 }])}><Plus />Add assertion</Button>
    </div>
  )
}
