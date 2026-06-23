import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
  RiArrowRightSLine,
  RiDeleteBin6Line,
  RiFileEditLine,
  RiReceiptLine,
  RiMore2Line,
  RiEyeLine,
  RiBox3Line,
  RiSettings4Line,
  RiShieldCheckLine,
  RiTruckLine,
  RiLoader4Line,
} from '@remixicon/react'
import { cn } from '@/lib/utils'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrder, SalesOrderStatus } from '@/types/erp.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { formatCurrency, formatDate } from '@/utils/formatters'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import toast from 'react-hot-toast'
import { SalesOrderStatusBadge } from '@/components/sales-orders/SalesOrderStatusBadge'
import { getNextAction } from '@/components/sales-orders/SalesOrderWorkflowActions'
import { SalesOrderDetailSheet } from '@/components/sales-orders/SalesOrderDetailSheet'

const DraftCard = ({
  order,
  onContinue,
  onDelete,
}: {
  order: SalesOrder
  onContinue: () => void
  onDelete: () => void
}) => (
  <div className="relative flex flex-shrink-0 flex-col gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30 w-56">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">
          {order.order_number}
        </p>
        <p className="text-sm font-medium text-foreground truncate mt-0.5">
          {order.patient_name || 'Unknown patient'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
      </div>
      <RiFileEditLine className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute right-2 top-2 text-amber-700 hover:bg-amber-100 hover:text-destructive dark:text-amber-300 dark:hover:bg-amber-900/40"
      onClick={onDelete}
      aria-label={`Delete draft ${order.order_number}`}
    >
      <RiDeleteBin6Line className="h-4 w-4" />
    </Button>
    <Button
      size="sm"
      variant="outline"
      className="w-full text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
      onClick={onContinue}
    >
      Continue editing
      <RiArrowRightSLine className="ml-1 h-3 w-3" />
    </Button>
  </div>
)

const STATUS_FILTER_OPTIONS: Array<{ id: SalesOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All Statuses' },
  { id: 'created', label: 'Order Created' },
  { id: 'lens_ordered', label: 'Lens Ordered' },
  { id: 'fitting', label: 'Sent for Fitting' },
  { id: 'ready', label: 'Ready for Collection' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const LIFECYCLE_FILTER_TABS: Array<{ id: SalesOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Order Created' },
  { id: 'lens_ordered', label: 'Lens Ordered' },
  { id: 'fitting', label: 'Sent for Fitting' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
]

const WORKFLOW_ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lens_ordered: RiBox3Line,
  fitting: RiSettings4Line,
  ready: RiShieldCheckLine,
  delivered: RiTruckLine,
}

const SalesOrders = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [draftToDelete, setDraftToDelete] = useState<SalesOrder | null>(null)
  const [orderToEdit, setOrderToEdit] = useState<SalesOrder | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  const rowStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SalesOrderStatus }) =>
      salesOrdersApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      setPendingRowId(id)
      await queryClient.cancelQueries({ queryKey: ['sales-orders'] })
      const previousData = queryClient.getQueryData(['sales-orders', page, pageSize, statusFilter])
      queryClient.setQueriesData({ queryKey: ['sales-orders'] }, (old: any) => {
        if (!old?.data) return old
        return { ...old, data: old.data.map((o: SalesOrder) => o.order_id === id ? { ...o, status } : o) }
      })
      return { previousData }
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousData) queryClient.setQueryData(['sales-orders', page, pageSize, statusFilter], context.previousData)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
    onSettled: (_data, _err, { id }) => {
      setPendingRowId(null)
      setSelectedOrderIds((prev) => prev.filter((sid) => sid !== id))
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-ready-count'] })
    },
  })

  const deleteDraftMutation = useMutation({
    mutationFn: (orderId: string) => salesOrdersApi.delete(orderId),
    onSuccess: () => {
      toast.success('Draft deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setDraftToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete draft')
    },
  })

  const { data: draftsData } = useQuery({
    queryKey: ['sales-orders-drafts'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 10, status: 'draft' }),
  })
  const drafts = draftsData?.data || []

  const { data: readyCountData } = useQuery({
    queryKey: ['sales-orders-ready-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'ready' }),
    refetchInterval: 60_000,
  })
  const readyCount = readyCountData?.total ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, pageSize, statusFilter],
    queryFn: () =>
      salesOrdersApi.getAll({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
      }),
  })

  const orders = data?.data || []

  const isAllSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.order_id))
  const isIndeterminate =
    selectedOrderIds.some((id) => orders.some((o) => o.order_id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.order_id)),
    [orders, selectedOrderIds],
  )

  const toggleAll = (checked: boolean) => {
    const visibleIds = orders.map((o) => o.order_id)
    if (checked) {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    }
  }

  const toggleOne = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) =>
      checked ? [...prev, orderId] : prev.filter((id) => id !== orderId),
    )
  }

  const handleRowClick = (order: SalesOrder) => {
    setDetailOrderId(order.order_id)
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  // Compute workflow action for selected rows (only shown when all selected rows share the same lifecycle action)
  const selectedStatuses = useMemo(
    () => new Set(selectedRows.map((o) => o.status)),
    [selectedRows],
  )
  const commonNextAction = useMemo(() => {
    if (selectedRows.length === 0 || selectedStatuses.size !== 1) return null
    return getNextAction([...selectedStatuses][0])
  }, [selectedRows, selectedStatuses])

  const rowActions = useMemo<RowAction<SalesOrder>[]>(() => {
    const actions: RowAction<SalesOrder>[] = []

    // Workflow action is primary — comes first and stands out
    if (commonNextAction) {
      const Icon = WORKFLOW_ACTION_ICONS[commonNextAction.toStatus] ?? RiBox3Line
      actions.push({
        id: `workflow-${commonNextAction.toStatus}`,
        label: commonNextAction.label,
        icon: Icon,
        primary: true,
        showWhen: 'any',
        onClick: (rows) => {
          const promises = rows.map((r) =>
            salesOrdersApi.updateStatus(r.order_id, commonNextAction.toStatus),
          )
          toast.promise(Promise.all(promises), {
            loading: `Updating ${rows.length > 1 ? `${rows.length} orders` : 'order'}…`,
            success: () => {
              queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
              setSelectedOrderIds([])
              return `Moved to "${commonNextAction.label}"`
            },
            error: 'Some updates failed',
          })
        },
      })
    }

    actions.push({
      id: 'edit-order',
      label: 'Edit / Continue',
      icon: RiFileEditLine,
      onClick: (rows) => {
        const order = rows[0]
        if (order.status === 'draft') {
          navigate(`/sales-orders/assistant?draft=${order.order_id}`)
        } else {
          setOrderToEdit(order)
        }
      },
      showWhen: 'single',
      primary: !commonNextAction,
    })

    if (selectedRows.length === 1 && selectedRows[0]?.invoice_id) {
      actions.push({
        id: 'view-invoice',
        label: 'View Invoice',
        icon: RiReceiptLine,
        onClick: (rows) => {
          if (rows[0].invoice_id) navigate(`/invoices?detail=${rows[0].invoice_id}`)
        },
        showWhen: 'single',
      })
    }

    if (selectedRows.length === 1 && selectedRows[0]?.status === 'draft' && !selectedRows[0]?.invoice_id) {
      actions.push({
        id: 'delete-order',
        label: 'Delete Draft',
        icon: RiDeleteBin6Line,
        onClick: (rows) => setDraftToDelete(rows[0]),
        showWhen: 'single',
      })
    }

    return actions
  }, [commonNextAction, selectedRows, queryClient, navigate])

  const columns = useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all orders"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.order_number}`}
            checked={selectedOrderIds.includes(row.original.order_id)}
            onCheckedChange={(checked) => toggleOne(row.original.order_id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'order_number',
        header: 'Order #',
        cell: ({ row }) => (
          <button
            className="flex flex-col text-left group"
            onClick={(e) => { e.stopPropagation(); setDetailOrderId(row.original.order_id) }}
          >
            <span className="font-medium text-primary group-hover:underline underline-offset-2">
              {row.original.order_number}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.order_id}</span>
          </button>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">
              {row.original.patient_name || row.original.patient_id}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.patient_id}</span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <SalesOrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => row.original.items.length,
        enableSorting: false,
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatCurrency(row.original.total_amount || row.original.subtotal || 0)}
          </span>
        ),
      },
      {
        accessorKey: 'expected_delivery_date',
        header: 'Delivery',
        cell: ({ row }) =>
          row.original.expected_delivery_date
            ? formatDate(row.original.expected_delivery_date)
            : '-',
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => {
          const d = row.original.created_at ? new Date(row.original.created_at) : null
          if (!d) return '-'
          return (
            <div className="flex flex-col">
              <span>{formatDate(d)}</span>
              <span className="text-xs text-muted-foreground">
                {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        },
      },
      {
        id: 'invoice',
        header: 'Invoice',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.invoice_id ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/invoices?detail=${row.original.invoice_id}`)}
            >
              View Invoice
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Not generated</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const order = row.original
          const nextAction = getNextAction(order.status)
          const isRowPending = pendingRowId === order.order_id
          const Icon = nextAction
            ? (WORKFLOW_ACTION_ICONS[nextAction.toStatus] ?? RiBox3Line)
            : null

          return (
            <div className="flex items-center gap-1.5 justify-end">
              {/* Primary inline workflow action — always visible */}
              {nextAction && Icon && (
                <Button
                  size="sm"
                  disabled={isRowPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    rowStatusMutation.mutate(
                      { id: order.order_id, status: nextAction.toStatus },
                      {
                        onSuccess: () =>
                          toast.success(`"${order.order_number}" → ${nextAction.label}`),
                      },
                    )
                  }}
                  className={cn(
                    'h-7 gap-1 px-2.5 text-xs font-semibold shadow-none',
                    nextAction.className,
                  )}
                >
                  {isRowPending ? (
                    <RiLoader4Line className="size-3 animate-spin" />
                  ) : (
                    <Icon className="size-3" />
                  )}
                  {nextAction.label}
                </Button>
              )}

              {/* Utility-only ellipsis */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="data-[state=open]:bg-muted"
                    aria-label="More actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RiMore2Line className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setDetailOrderId(order.order_id)}>
                    <RiEyeLine className="size-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (order.status === 'draft') {
                        navigate(`/sales-orders/assistant?draft=${order.order_id}`)
                      } else {
                        setOrderToEdit(order)
                      }
                    }}
                  >
                    <RiFileEditLine className="size-4" />
                    Edit Order
                  </DropdownMenuItem>
                  {order.invoice_id && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/invoices?detail=${order.invoice_id}`)}
                    >
                      <RiReceiptLine className="size-4" />
                      View Invoice
                    </DropdownMenuItem>
                  )}
                  {order.status === 'draft' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDraftToDelete(order)}
                      >
                        <RiDeleteBin6Line className="size-4" />
                        Delete Draft
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [isAllSelected, isIndeterminate, selectedOrderIds, pendingRowId, queryClient, navigate, rowStatusMutation],
  )

  return (
    <div className="space-y-6">
      {/* Draft cards */}
      {drafts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 mb-3">
            <RiFileEditLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {drafts.length} draft {drafts.length === 1 ? 'order' : 'orders'} in progress
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {drafts.map((order) => (
              <DraftCard
                key={order.order_id}
                order={order}
                onContinue={() => navigate(`/sales-orders/assistant?draft=${order.order_id}`)}
                onDelete={() => setDraftToDelete(order)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit order confirmation (non-draft orders) */}
      <AlertDialog open={!!orderToEdit} onOpenChange={(open) => { if (!open) setOrderToEdit(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{orderToEdit?.order_number}</strong> has already been processed (status:{' '}
              <strong>{orderToEdit?.status?.replace(/_/g, ' ')}</strong>). Editing it may affect
              linked inventory, prescriptions, or invoices. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToEdit(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToEdit) navigate(`/sales-orders/assistant?draft=${orderToEdit.order_id}`)
                setOrderToEdit(null)
              }}
            >
              Edit Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete draft dialog */}
      <AlertDialog
        open={!!draftToDelete}
        onOpenChange={(open) => {
          if (!open) setDraftToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove draft{' '}
              {draftToDelete?.order_number || 'this order'} and its unsaved progress. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDraftToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => draftToDelete && deleteDraftMutation.mutate(draftToDelete.order_id)}
              disabled={deleteDraftMutation.isPending}
            >
              {deleteDraftMutation.isPending ? 'Deleting…' : 'Delete Draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sales order detail sheet */}
      <SalesOrderDetailSheet
        orderId={detailOrderId}
        open={!!detailOrderId}
        onOpenChange={(open) => { if (!open) setDetailOrderId(null) }}
      />

      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">
            Live order processing workspace — track and advance every order through its lifecycle.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => navigate('/sales-orders/assistant')}
        >
          <RiAddLine className="size-4" />
          New Sales Order
        </Button>
      </section>

      {/* Lifecycle quick-filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LIFECYCLE_FILTER_TABS.map((tab) => {
          const isActive = (statusFilter === '' && tab.id === 'all') || statusFilter === tab.id
          const isReady = tab.id === 'ready'
          return (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id === 'all' ? '' : (tab.id as SalesOrderStatus))
                setPage(1)
              }}
              className={`relative flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isReady && readyCount > 0
                    ? 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {tab.label}
              {isReady && readyCount > 0 && (
                <span className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {readyCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Order Records</CardTitle>
              <CardDescription>
                Select an order to advance it through the workflow.{' '}
                <span className="text-foreground/60">Inline action buttons show the next step for each order.</span>
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => {
                setStatusFilter(value === 'all' ? '' : (value as SalesOrderStatus))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-32" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={orders}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            loading={isLoading}
            searchPlaceholder="Search orders…"
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={handleRowClick}
            onClearSelection={() => setSelectedOrderIds([])}
            emptyMessage="No sales orders found."
          />
          {data && (
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              totalItems={data.total}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesOrders
