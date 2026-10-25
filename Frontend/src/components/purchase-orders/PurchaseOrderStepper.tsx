import { cn } from '@/lib/utils'
import { RiCheckLine } from '@remixicon/react'
import { PurchaseOrderStatus } from '@/types/supplier.types'
import { PO_LIFECYCLE_STEPS, getPOLifecycleIndex } from './purchaseOrderLifecycle'

interface PurchaseOrderStepperProps {
  status: PurchaseOrderStatus
  className?: string
}

export function PurchaseOrderStepper({ status, className }: PurchaseOrderStepperProps) {
  const activeIndex = getPOLifecycleIndex(status)
  // Closed is the end of the road, so it shows as done rather than in progress
  const doneIndex = status === 'Closed' ? PO_LIFECYCLE_STEPS.length : activeIndex

  if (activeIndex === -1) return null

  return (
    <nav aria-label="Purchase order lifecycle" className={cn('w-full', className)}>
      {/* Equal-width columns keep the connectors the same length whatever the label */}
      <ol className="grid w-full" style={{ gridTemplateColumns: `repeat(${PO_LIFECYCLE_STEPS.length}, minmax(0, 1fr))` }}>
        {PO_LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < doneIndex
          const isActive = index === doneIndex
          const isUpcoming = index > doneIndex
          const isLast = index === PO_LIFECYCLE_STEPS.length - 1
          const label = step.status === 'Received' && status === 'Partially Received' ? 'Part received' : step.shortLabel

          return (
            <li key={step.status} className="relative flex flex-col items-center gap-1.5">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-[15px] h-0.5 rounded-full transition-colors',
                    index < doneIndex ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-muted',
                  )}
                  style={{ left: 'calc(50% + 20px)', width: 'calc(100% - 40px)' }}
                />
              )}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                  isActive && 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-4 ring-primary/15',
                  isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground/50',
                )}
              >
                {isCompleted ? (
                  <RiCheckLine className="size-3.5" />
                ) : (
                  <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'hidden sm:block px-0.5 text-center text-[11px] leading-tight',
                  isCompleted && 'text-emerald-600 dark:text-emerald-400 font-medium',
                  isActive && 'text-foreground font-semibold',
                  isUpcoming && 'text-muted-foreground/60',
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
