import type { ComponentType } from 'react'
import { RiBox3Line, RiSettings4Line, RiShieldCheckLine, RiTruckLine } from '@remixicon/react'
import type { SalesOrderStatus } from '@/types/erp.types'

export interface WorkflowAction {
  fromStatus: SalesOrderStatus
  toStatus: SalesOrderStatus
  label: string
  icon: ComponentType<{ className?: string }>
  className: string
}

export const WORKFLOW_ACTIONS: WorkflowAction[] = [
  {
    fromStatus: 'created',
    toStatus: 'lens_ordered',
    label: 'Order Lens',
    icon: RiBox3Line,
    className: 'bg-warning text-warning-foreground hover:bg-warning/90 border-warning',
  },
  {
    fromStatus: 'lens_ordered',
    toStatus: 'fitting',
    label: 'Send for Fitting',
    icon: RiSettings4Line,
    className: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
  },
  {
    fromStatus: 'fitting',
    toStatus: 'ready',
    label: 'Mark as Ready',
    icon: RiShieldCheckLine,
    className: 'bg-success text-success-foreground hover:bg-success/90 border-success',
  },
  {
    fromStatus: 'ready',
    toStatus: 'delivered',
    label: 'Complete Delivery',
    icon: RiTruckLine,
    className: 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary',
  },
]

// Legacy status → lifecycle status mapping for backward compat
const LEGACY_STATUS_MAP: Partial<Record<SalesOrderStatus, SalesOrderStatus>> = {
  confirmed: 'created',
  in_production: 'lens_ordered',
}

export function getNextAction(status: SalesOrderStatus): WorkflowAction | null {
  const resolved = LEGACY_STATUS_MAP[status] ?? status
  return WORKFLOW_ACTIONS.find((a) => a.fromStatus === resolved) ?? null
}
