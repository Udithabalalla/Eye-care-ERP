import { PurchaseOrderStatus } from '@/types/supplier.types'

export const PO_LIFECYCLE_STEPS: Array<{
  status: PurchaseOrderStatus
  label: string
  shortLabel: string
}> = [
  { status: 'Draft', label: 'Draft', shortLabel: 'Draft' },
  { status: 'Approved', label: 'Approved', shortLabel: 'Approved' },
  { status: 'Ordered', label: 'Ordered', shortLabel: 'Ordered' },
  { status: 'Received', label: 'Received', shortLabel: 'Received' },
  { status: 'Closed', label: 'Closed', shortLabel: 'Closed' },
]

export const LIFECYCLE_ORDER = PO_LIFECYCLE_STEPS.map((s) => s.status)

export function getPOLifecycleIndex(status: PurchaseOrderStatus): number {
  return LIFECYCLE_ORDER.indexOf(status)
}
