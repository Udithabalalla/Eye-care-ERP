import { PurchaseOrder, PurchaseOrderStatus } from '@/types/supplier.types'
import {
  RiShieldCheckLine,
  RiTruckLine,
  RiFileTextLine,
  RiMailSendLine,
} from '@remixicon/react'

export interface POWorkflowAction {
  fromStatus: PurchaseOrderStatus
  toStatus: PurchaseOrderStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
  className: string
  requiresDialog: boolean
}

export const PO_WORKFLOW_ACTIONS: POWorkflowAction[] = [
  {
    fromStatus: 'Draft',
    toStatus: 'Approved',
    label: 'Approve Order',
    icon: RiShieldCheckLine,
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
    requiresDialog: false,
  },
  {
    // Placing the order: email it, or mark it ordered when it went another way
    fromStatus: 'Approved',
    toStatus: 'Ordered',
    label: 'Send to Supplier',
    icon: RiMailSendLine,
    className: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    requiresDialog: true,
  },
  {
    fromStatus: 'Ordered',
    toStatus: 'Received',
    label: 'Receive Goods',
    icon: RiTruckLine,
    className: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
    requiresDialog: true,
  },
  {
    // A short delivery leaves the PO open until the rest arrives
    fromStatus: 'Partially Received',
    toStatus: 'Received',
    label: 'Receive Remaining',
    icon: RiTruckLine,
    className: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
    requiresDialog: true,
  },
  {
    fromStatus: 'Received',
    toStatus: 'Closed',
    label: 'Add Supplier Invoice',
    icon: RiFileTextLine,
    className: 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary',
    requiresDialog: true,
  },
]

export function getPONextAction(status: PurchaseOrderStatus): POWorkflowAction | null {
  return PO_WORKFLOW_ACTIONS.find((a) => a.fromStatus === status) ?? null
}

export function getPOCommonAction(orders: PurchaseOrder[]): POWorkflowAction | null {
  if (orders.length === 0) return null
  const statuses = new Set(orders.map((o) => o.status))
  if (statuses.size !== 1) return null
  return getPONextAction([...statuses][0])
}
