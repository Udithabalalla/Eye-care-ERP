import { cn } from '@/lib/utils'
import { POStatusHistoryEntry } from '@/types/supplier.types'
import { PO_STATUS_CONFIG } from './purchaseOrderStatusConfig'

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface PurchaseOrderTimelineProps {
  history: POStatusHistoryEntry[]
  createdAt?: string
  createdBy?: string
  className?: string
}

export function PurchaseOrderTimeline({
  history,
  createdAt,
  createdBy,
  className,
}: PurchaseOrderTimelineProps) {
  const entries: Array<{ status: string; label: string; time: string; by: string }> = []

  if (createdAt) {
    entries.push({
      status: 'Draft',
      label: 'Order Created',
      time: createdAt,
      by: createdBy ?? '',
    })
  }

  for (const entry of history) {
    const config = PO_STATUS_CONFIG[entry.status as keyof typeof PO_STATUS_CONFIG]
    entries.push({
      status: entry.status,
      label: config?.label ?? entry.status,
      time: entry.updated_at,
      by: entry.updated_by,
    })
  }

  if (entries.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>No history recorded.</p>
    )
  }

  return (
    <ol className={cn('relative flex flex-col gap-0', className)}>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
            )}
            <div
              className={cn(
                'relative z-10 mt-0.5 h-4.5 w-4.5 flex-shrink-0 rounded-full border-2',
                isLast
                  ? 'border-primary bg-primary'
                  : 'border-emerald-500 bg-emerald-500',
              )}
            />
            <div className="min-w-0 flex-1 pt-px">
              <p className="text-xs font-semibold text-foreground leading-tight">{entry.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatTime(entry.time)}</p>
              {entry.by && (
                <p className="text-xs text-muted-foreground/60 truncate">{entry.by}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
