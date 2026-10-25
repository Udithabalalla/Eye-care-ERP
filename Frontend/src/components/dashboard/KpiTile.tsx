import { RiArrowDownLine, RiArrowUpLine } from '@remixicon/react'
import { cn } from '@/lib/utils'

/** Signed change against a named earlier period, or a plain note when there's nothing to compare with */
export function Delta({ now, before, against, noneBefore }: { now: number; before: number; against: string; noneBefore: string }) {
  if (!before) {
    return <span className="text-xs text-muted-foreground">{noneBefore}</span>
  }
  const change = ((now - before) / before) * 100
  const up = change >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {up ? <RiArrowUpLine className="size-3.5" aria-hidden /> : <RiArrowDownLine className="size-3.5" aria-hidden />}
      {Math.abs(change).toFixed(0)}%
      <span className="font-normal text-muted-foreground">&nbsp;{against}</span>
    </span>
  )
}

/**
 * One headline number: label · value · what it compares to. Clickable when it
 * leads somewhere you'd act on it.
 */
export function KpiTile({
  icon: Icon,
  label,
  value,
  footer,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  footer?: React.ReactNode
  tone?: 'warn'
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-xs transition-colors enabled:hover:border-primary/40 disabled:cursor-default"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          <span className="truncate whitespace-nowrap">{label}</span>
        </span>
      </span>
      <span className={cn('truncate text-2xl font-semibold tracking-tight', tone === 'warn' && 'text-amber-600 dark:text-amber-400')}>{value}</span>
      {footer && <span className="min-h-4 truncate">{footer}</span>}
    </button>
  )
}
