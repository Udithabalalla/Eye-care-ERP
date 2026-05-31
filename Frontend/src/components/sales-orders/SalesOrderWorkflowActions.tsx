import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrder, SalesOrderStatus } from '@/types/erp.types'
import { Button } from '@/components/ui/button'
import {
  RiBox3Line,
  RiSettings4Line,
  RiShieldCheckLine,
  RiTruckLine,
  RiLoader4Line,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export interface WorkflowAction {
  fromStatus: SalesOrderStatus
  toStatus: SalesOrderStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
  className: string
}

export const WORKFLOW_ACTIONS: WorkflowAction[] = [
  {
    fromStatus: 'created',
    toStatus: 'lens_ordered',
    label: 'Order Lens',
    icon: RiBox3Line,
    className: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
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
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
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

function getCommonAction(orders: SalesOrder[]): WorkflowAction | null {
  if (orders.length === 0) return null
  const statuses = new Set(orders.map((o) => o.status))
  if (statuses.size !== 1) return null
  return getNextAction([...statuses][0])
}

interface SalesOrderWorkflowActionsProps {
  selectedOrders: SalesOrder[]
  queryKey?: unknown[]
  size?: 'sm' | 'default'
  className?: string
}

export function SalesOrderWorkflowActions({
  selectedOrders,
  queryKey = ['sales-orders'],
  size = 'sm',
  className,
}: SalesOrderWorkflowActionsProps) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SalesOrderStatus }) =>
      salesOrdersApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey })
      await queryClient.cancelQueries({ queryKey: ['sales-orders'] })
      const previousData = queryClient.getQueryData(queryKey)
      queryClient.setQueriesData({ queryKey: ['sales-orders'] }, (old: any) => {
        if (!old?.data) return old
        return { ...old, data: old.data.map((o: SalesOrder) => o.order_id === id ? { ...o, status } : o) }
      })
      queryClient.setQueryData(['sales-order', id], (old: any) => old ? { ...old, status } : old)
      return { previousData }
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    },
  })

  const action = getCommonAction(selectedOrders)
  const mixedStatuses = new Set(selectedOrders.map((o) => o.status)).size > 1

  if (selectedOrders.length === 0) return null

  if (mixedStatuses) {
    return (
      <span className={cn('text-xs text-muted-foreground px-1', className)}>
        Mixed statuses — select orders at the same stage to advance together
      </span>
    )
  }

  if (!action) return null

  const Icon = action.icon
  const isPending = statusMutation.isPending

  const handleClick = () => {
    const promises = selectedOrders.map((order) =>
      statusMutation.mutateAsync({ id: order.order_id, status: action.toStatus }),
    )
    toast.promise(Promise.all(promises), {
      loading: `Updating ${selectedOrders.length > 1 ? `${selectedOrders.length} orders` : 'order'}…`,
      success: `${selectedOrders.length > 1 ? `${selectedOrders.length} orders` : 'Order'} moved to "${action.label}"`,
      error: 'Some updates failed',
    })
  }

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={isPending}
      className={cn('gap-1.5 font-semibold shadow-sm', action.className, className)}
    >
      {isPending ? (
        <RiLoader4Line className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
      {action.label}
    </Button>
  )
}
