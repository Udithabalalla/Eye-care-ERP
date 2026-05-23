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

export const LIFECYCLE_ORDER = LIFECYCLE_STEPS.map((s) => s.status)

export function isLifecycleStatus(status: SalesOrderStatus): boolean {
  return LIFECYCLE_ORDER.includes(status)
}

export function getLifecycleIndex(status: SalesOrderStatus): number {
  return LIFECYCLE_ORDER.indexOf(status)
}
