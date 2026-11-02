import { cn } from '@/lib/utils'
import { methodColor, statusTone, toneBg } from '@/lib/format'

export function StatusBadge({ code, error }: { code?: number; error?: string }) {
  const label = code ?? (error ? error.replace(/_/g, ' ') : 'ERR')
  return (
    <span className={cn('inline-flex h-5 items-center rounded px-1.5 font-mono text-xs font-medium', toneBg[statusTone(code)])}>
      {label}
    </span>
  )
}

export function MethodLabel({ method, className }: { method: string; className?: string }) {
  return (
    <span className={cn('inline-block w-14 font-mono text-xs font-semibold', methodColor[method as keyof typeof methodColor], className)}>
      {method}
    </span>
  )
}
