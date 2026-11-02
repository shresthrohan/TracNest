import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffChange, DiffKind } from '@/types'

const style: Record<DiffKind, { row: string; mark: string; sym: string }> = {
  added: { row: 'bg-success/10', mark: 'text-success', sym: '+' },
  removed: { row: 'bg-destructive/10', mark: 'text-destructive', sym: '-' },
  changed: { row: 'bg-warning/10', mark: 'text-warning', sym: '~' },
  type: { row: 'bg-violet/10', mark: 'text-violet', sym: 'T' },
}
const isContainer = (v: unknown): v is object => v !== null && typeof v === 'object'
const short = (v: unknown) => {
  const s = JSON.stringify(v) ?? 'undefined'
  return s.length > 120 ? `${s.slice(0, 117)}...` : s
}
const childPath = (p: string, k: string, arr: boolean) => (arr ? `${p}[${k}]` : p ? `${p}.${k}` : k)

type Ctx = { changes: Map<string, DiffChange>; paths: string[] }

function Row({ depth, name, kind, children }: { depth: number; name?: string; kind?: DiffKind; children: React.ReactNode }) {
  return (
    <div className={cn('flex gap-2 rounded-sm py-0.5 pr-2 font-mono text-xs', kind && style[kind].row)} style={{ paddingLeft: depth * 16 + 8 }}>
      <span className={cn('w-3 shrink-0 text-center font-semibold', kind ? style[kind].mark : 'text-transparent')}>{kind ? style[kind].sym : '.'}</span>
      {name !== undefined && <span className="shrink-0 text-muted-foreground">{name}:</span>}
      <span className="min-w-0 break-all">{children}</span>
    </div>
  )
}

function Node({ name, path, a, b, depth, ctx }: { name?: string; path: string; a: unknown; b: unknown; depth: number; ctx: Ctx }) {
  const change = ctx.changes.get(path)
  const touched = path === '' ? ctx.paths.length > 0 : ctx.paths.some((p) => p === path || p.startsWith(`${path}.`) || p.startsWith(`${path}[`))
  const [open, setOpen] = useState(touched)

  if (change) {
    const { kind, before, after } = change
    return (
      <Row depth={depth} name={name} kind={kind}>
        {kind === 'added' ? short(after) : kind === 'removed' ? short(before) : (
          <><span className="text-destructive/90 line-through decoration-destructive/40">{short(before)}</span> <span className="text-muted-foreground">to</span> <span className="text-success">{short(after)}</span></>
        )}
      </Row>
    )
  }
  if (isContainer(a) && isContainer(b) && Array.isArray(a) === Array.isArray(b)) {
    const arr = Array.isArray(a)
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const keys = arr ? Array.from({ length: Math.max((a as unknown[]).length, (b as unknown[]).length) }, (_, i) => String(i)) : [...new Set([...Object.keys(ao), ...Object.keys(bo)])]
    const [o, c] = arr ? ['[', ']'] : ['{', '}']
    return (
      <div>
        <button className="flex w-full items-center gap-1 rounded-sm py-0.5 pr-2 text-left font-mono text-xs hover:bg-accent/50" style={{ paddingLeft: depth * 16 + 8 }} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
          {name !== undefined && <span className="text-muted-foreground">{name}:</span>}
          <span>{o}</span>
          {!open && <span className="text-muted-foreground">{keys.length} {arr ? 'items' : 'keys'}, unchanged {c}</span>}
        </button>
        {open && (
          <>
            {keys.map((k) => <Node key={k} name={arr ? undefined : k} path={childPath(path, k, arr)} a={ao[k]} b={bo[k]} depth={depth + 1} ctx={ctx} />)}
            <div className="font-mono text-xs" style={{ paddingLeft: depth * 16 + 8 + 12 }}>{c}</div>
          </>
        )}
      </div>
    )
  }
  return <Row depth={depth} name={name}><span className="text-muted-foreground">{short(a)}</span></Row>
}

export function DiffTree({ a, b, changes }: { a: unknown; b: unknown; changes: DiffChange[] }) {
  const map = new Map(changes.map((c) => [c.path === '$' ? '' : c.path, c]))
  const ctx: Ctx = { changes: map, paths: [...map.keys()] }
  return (
    <div className="overflow-auto rounded-lg border bg-surface py-2">
      <Node path="" a={a} b={b} depth={0} ctx={ctx} />
    </div>
  )
}
