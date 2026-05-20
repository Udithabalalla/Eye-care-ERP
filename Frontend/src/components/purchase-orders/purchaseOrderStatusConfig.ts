import { PurchaseOrderStatus } from '@/types/supplier.types'

export const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  Draft: {
    label: 'Draft',
    className:
      'bg-gray-100 text-gray-500 border-gray-200 border-dashed dark:bg-gray-800/40 dark:text-gray-500 dark:border-gray-700',
  },
  Approved: {
    label: 'Approved',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  Ordered: {
    label: 'Ordered',
    className:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  Received: {
    label: 'Received',
    className:
      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  Closed: {
    label: 'Closed',
    className:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
  },
}

export const PO_STATUS_CONFIG = STATUS_CONFIG
