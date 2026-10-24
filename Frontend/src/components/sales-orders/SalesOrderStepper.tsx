import { cn } from '@/lib/utils'
import { RiCheckLine } from '@remixicon/react'
import { SalesOrderStatus } from '@/types/erp.types'
import { LIFECYCLE_STEPS, getLifecycleIndex } from './salesOrderLifecycle'

interface SalesOrderStepperProps {
  status: SalesOrderStatus
  className?: string
}

export function SalesOrderStepper({ status, className }: SalesOrderStepperProps) {
  const activeIndex = getLifecycleIndex(status)

  if (activeIndex === -1) return null

  return (
    <nav aria-label="Order lifecycle" className={cn('w-full', className)}>
      {/* Equal-width columns keep the connectors the same length whatever the label */}
      <ol className="grid w-full" style={{ gridTemplateColumns: `repeat(${LIFECYCLE_STEPS.length}, minmax(0, 1fr))` }}>
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < activeIndex
          const isActive = index === activeIndex
          const isUpcoming = index > activeIndex
          const isLast = index === LIFECYCLE_STEPS.length - 1

          return (
            <li key={step.status} className="relative flex flex-col items-center gap-1.5">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-[15px] h-0.5 rounded-full transition-colors',
                    index < activeIndex ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-muted',
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
                {step.shortLabel}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
