import { cn } from '@/lib/utils'
import { RiCheckLine } from '@remixicon/react'
import { SalesOrderStatus } from '@/types/erp.types'

export const LIFECYCLE_STEPS: Array<{
  status: SalesOrderStatus
  label: string
  shortLabel: string
}> = [
  { status: 'created', label: 'Order Created', shortLabel: 'Created' },
  { status: 'lens_ordered', label: 'Lens Ordered', shortLabel: 'Lens Ordered' },
  { status: 'fitting', label: 'Sent for Fitting', shortLabel: 'Fitting' },
  { status: 'ready', label: 'Ready for Collection', shortLabel: 'Ready' },
  { status: 'delivered', label: 'Delivered', shortLabel: 'Delivered' },
]

const LIFECYCLE_ORDER = LIFECYCLE_STEPS.map((s) => s.status)

export function isLifecycleStatus(status: SalesOrderStatus): boolean {
  return LIFECYCLE_ORDER.includes(status)
}

export function getLifecycleIndex(status: SalesOrderStatus): number {
  return LIFECYCLE_ORDER.indexOf(status)
}

interface SalesOrderStepperProps {
  status: SalesOrderStatus
  className?: string
}

export function SalesOrderStepper({ status, className }: SalesOrderStepperProps) {
  const activeIndex = getLifecycleIndex(status)

  if (activeIndex === -1) return null

  return (
    <nav aria-label="Order lifecycle" className={cn('w-full', className)}>
      <ol className="flex items-center w-full">
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < activeIndex
          const isActive = index === activeIndex
          const isUpcoming = index > activeIndex
          const isLast = index === LIFECYCLE_STEPS.length - 1

          return (
            <li
              key={step.status}
              className={cn('flex items-center', isLast ? 'flex-none' : 'flex-1')}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-all',
                    isCompleted && 'h-7 w-7 border-emerald-500 bg-emerald-500 text-white',
                    isActive && 'h-8 w-8 border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                    isUpcoming && 'h-7 w-7 border-muted-foreground/30 bg-background text-muted-foreground/40',
                  )}
                >
                  {isCompleted ? (
                    <RiCheckLine className="size-3.5" />
                  ) : (
                    <span className={cn('text-xs font-semibold tabular-nums', isActive && 'text-sm')}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'hidden sm:block text-center text-xs leading-tight max-w-[72px]',
                    isCompleted && 'text-emerald-600 dark:text-emerald-400 font-medium',
                    isActive && 'text-foreground font-semibold',
                    isUpcoming && 'text-muted-foreground/50',
                  )}
                >
                  {step.shortLabel}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 rounded-full transition-all',
                    index < activeIndex ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-muted',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
