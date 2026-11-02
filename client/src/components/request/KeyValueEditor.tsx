import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KV } from '@/types'

export function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: {
  rows: KV[]
  onChange: (rows: KV[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  const patch = (i: number, p: Partial<KV>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => patch(i, { enabled: e.target.checked })}
            aria-label="Enabled"
            className="size-3.5 accent-[var(--primary)]"
          />
          <Input className="h-8 font-mono text-xs" placeholder={keyPlaceholder} value={r.key} onChange={(e) => patch(i, { key: e.target.value })} />
          <Input className="h-8 font-mono text-xs" placeholder={valuePlaceholder} value={r.value} onChange={(e) => patch(i, { value: e.target.value })} />
          <Button variant="ghost" size="icon-sm" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange([...rows, { key: '', value: '', enabled: true }])}>
        <Plus /> Add row
      </Button>
    </div>
  )
}
