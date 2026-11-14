import { RiArrowDownLine, RiArrowUpLine } from '@remixicon/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Signed change against a named earlier period, or a plain note when there's nothing to compare with */
export function Delta({ now, before, against, noneBefore }: { now: number; before: number; against: string; noneBefore: string }) {
  if (!before) {
    return <span className="text-xs text-muted-foreground">{noneBefore}</span>
  }
  const change = ((now - before) / before) * 100
  const up = change >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-success' : 'text-destructive')}>
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
  const tile =
    'group flex h-auto min-w-0 flex-col items-stretch justify-start gap-2 whitespace-normal rounded-xl border border-border bg-card px-4 py-3.5 text-left font-normal shadow-xs'
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          <span className="truncate whitespace-nowrap">{label}</span>
        </span>
      </span>
      <span className={cn('truncate text-2xl font-semibold tracking-tight', tone === 'warn' && 'text-warning')}>{value}</span>
      {footer && <span className="min-h-4 truncate">{footer}</span>}
    </>
  )

  // Clickable tiles are buttons; the rest are plain cards (a disabled button would fade out)
  return onClick ? (
    <Button type="button" variant="outline" onClick={onClick} className={cn(tile, 'hover:border-primary/40 hover:bg-card dark:bg-card dark:hover:bg-card')}>
      {body}
    </Button>
  ) : (
    <div className={tile}>{body}</div>
  )
}
