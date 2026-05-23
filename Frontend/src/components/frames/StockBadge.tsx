import { cn } from '@/lib/utils'
import { FrameVariant } from '@/types/frames.types'

interface StockBadgeProps {
  stock: number
  reorderLevel: number
  showCount?: boolean
  className?: string
}

export function StockBadge({ stock, reorderLevel, showCount = true, className }: StockBadgeProps) {
  const isOut = stock === 0
  const isLow = !isOut && stock <= reorderLevel

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        isOut && 'bg-destructive/10 text-destructive',
        isLow && !isOut && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        !isLow && !isOut && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          isOut && 'bg-destructive',
          isLow && !isOut && 'bg-amber-500',
          !isLow && !isOut && 'bg-green-500',
        )}
      />
      {showCount ? (
        <>
          {isOut ? 'Out of stock' : isLow ? `Low (${stock})` : stock}
        </>
      ) : (
        isOut ? 'Out' : isLow ? 'Low' : 'OK'
      )}
    </span>
  )
}

export function stockLevel(variant: Pick<FrameVariant, 'current_stock' | 'reorder_level'>) {
  if (variant.current_stock === 0) return 'out'
  if (variant.current_stock <= variant.reorder_level) return 'low'
  return 'ok'
}
