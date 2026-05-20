import { SalesOrderStatus } from '@/types/erp.types'

export const STATUS_CONFIG: Record<
  SalesOrderStatus,
  { label: string; className: string }
> = {
  created: {
    label: 'Order Created',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  lens_ordered: {
    label: 'Lens Ordered',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  fitting: {
    label: 'Sent for Fitting',
    className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  ready: {
    label: 'Ready for Collection',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
  },
  // Legacy statuses
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-500 border-gray-200 border-dashed dark:bg-gray-800/40 dark:text-gray-500 dark:border-gray-700',
  },
  confirmed: {
    label: 'Order Created',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  in_production: {
    label: 'Lens Ordered',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  completed: {
    label: 'Completed',
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  },
}

export const SALES_STATUS_CONFIG = STATUS_CONFIG
