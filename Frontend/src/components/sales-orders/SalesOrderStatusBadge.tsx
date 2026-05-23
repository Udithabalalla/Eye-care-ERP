import { cn } from '@/lib/utils'
import { SalesOrderStatus } from '@/types/erp.types'
import { STATUS_CONFIG } from './salesOrderStatusConfig'

interface SalesOrderStatusBadgeProps {
  status: SalesOrderStatus
  className?: string
}

export function SalesOrderStatusBadge({ status, className }: SalesOrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}

// STATUS_CONFIG is provided by salesOrderStatusConfig
