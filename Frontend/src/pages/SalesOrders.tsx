import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
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
  RiDownloadLine,
  RiBarcodeLine,
  RiArrowRightLine,
  RiCloseCircleLine,
  RiFileExcel2Line,
} from '@remixicon/react'
import { downloadFile } from '@/utils/helpers'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrder, SalesOrderStatus } from '@/types/erp.types'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
import { DataTable, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { formatCurrency, formatDate, localDateString } from '@/utils/formatters'
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
import { SalesOrderStatusBadge } from '@/components/sales-orders/SalesOrderStatusBadge'
import { getNextAction } from '@/components/sales-orders/salesOrderWorkflow'
import { STATUS_CONFIG } from '@/components/sales-orders/salesOrderStatusConfig'
import { SalesOrderDetailSheet } from '@/components/sales-orders/SalesOrderDetailSheet'
import { FindOrderByReceiptDialog } from '@/components/sales-orders/FindOrderByReceiptDialog'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'

const LIFECYCLE_FILTER_TABS: Array<{ id: SalesOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Order Created' },
  { id: 'lens_ordered', label: 'Lens Ordered' },
  { id: 'fitting', label: 'Sent for Fitting' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
  // Unfinished orders saved to continue later
  { id: 'draft', label: 'Drafts' },
  { id: 'cancelled', label: 'Cancelled' },
]

// Orders that can still be cancelled: confirmed and not yet handed over (drafts are deleted instead)
const CANCELLABLE: SalesOrderStatus[] = ['created', 'confirmed', 'lens_ordered', 'in_production', 'fitting', 'ready']

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The selected orders as a spreadsheet (CSV opens in Excel) */
const ordersCsv = (orders: SalesOrder[]) => {
  // Each value quoted, quotes inside doubled (written by char code: a literal quote here trips check:tw)
  const quote = String.fromCharCode(34)
  const cell = (value: unknown) => quote + String(value ?? '').split(quote).join(quote + quote) + quote
  const rows = orders.map((o) => [
    o.order_number,
    o.patient_name || o.patient_id,
    STATUS_CONFIG[o.status]?.label ?? o.status,
    o.items.length,
    (o.total_amount || o.subtotal || 0).toFixed(2),
    o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '',
    o.created_at ? formatDate(o.created_at) : '',
    o.invoice_id ? 'Yes' : 'No',
  ])
  return [['Order #', 'Patient', 'Status', 'Items', 'Total (LKR)', 'Delivery', 'Created', 'Invoiced'], ...rows]
    .map((row) => row.map(cell).join(','))
    .join('\r\n')
}

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
  // Deep links (e.g. from notifications) can pre-select a status
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStatus = searchParams.get('status') as SalesOrderStatus | null
  useEffect(() => {
    if (urlStatus) { setStatusFilter(urlStatus); setPage(1) }
  }, [urlStatus])
  const [search, setSearch] = useState('')
  // Searched on the server (order number, order ID, patient name or phone), not just this page
  const debouncedSearch = useDebounce(search.trim(), 300)
  const { confirm, confirmDialog } = useConfirm()
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [orderToEdit, setOrderToEdit] = useState<SalesOrder | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [findByReceiptOpen, setFindByReceiptOpen] = useState(false)
  // Deep link from an invoice or notification: /sales-orders?detail=SO000123
  const urlDetail = searchParams.get('detail')
  useEffect(() => {
    if (urlDetail) setDetailOrderId(urlDetail)
  }, [urlDetail])

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
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete draft')
    },
  })

  // Only the count: drafts are listed under the Drafts filter like any other status
  const { data: draftsData } = useQuery({
    queryKey: ['sales-orders-drafts'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'draft' }),
  })
  const draftCount = draftsData?.total ?? 0

  const { data: readyCountData } = useQuery({
    queryKey: ['sales-orders-ready-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'ready' }),
    refetchInterval: 60_000,
  })
  const readyCount = readyCountData?.total ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, pageSize, statusFilter, debouncedSearch],
    queryFn: () =>
      salesOrdersApi.getAll({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      }),
  })

  const { mutate: deleteDraftNow } = deleteDraftMutation
  const deleteDraft = useCallback(async (order: SalesOrder) => {
    const ok = await confirm({
      title: 'Delete draft order?',
      description: `This permanently removes draft ${order.order_number || 'this order'} and its unsaved progress. This can't be undone.`,
      confirmLabel: 'Delete draft',
      destructive: true,
    })
    if (ok) deleteDraftNow(order.order_id)
  }, [confirm, deleteDraftNow])

  const orders = useMemo(() => data?.data || [], [data?.data])

  const isAllSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.order_id))
  const isIndeterminate =
    selectedOrderIds.some((id) => orders.some((o) => o.order_id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.order_id)),
    [orders, selectedOrderIds],
  )

  const toggleAll = useCallback((checked: boolean) => {
    const visibleIds = orders.map((o) => o.order_id)
    if (checked) {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    }
  }, [orders])

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

  /**
   * Run an action on each selected order, one at a time (stock moves on status changes, so
   * they don't race), then report how many worked. The selection is cleared afterwards.
   */
  const runBulk = useCallback(async (
    rows: SalesOrder[],
    run: (order: SalesOrder) => Promise<unknown>,
    messages: { loading: string; done: (count: number) => string },
  ) => {
    const toastId = toast.loading(messages.loading)
    let done = 0
    const failed: string[] = []
    for (const order of rows) {
      try {
        await run(order)
        done += 1
      } catch {
        failed.push(order.order_number || order.order_id)
      }
    }
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
    queryClient.invalidateQueries({ queryKey: ['sales-orders-ready-count'] })
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    setSelectedOrderIds([])
    if (failed.length === 0) toast.success(messages.done(done), { id: toastId })
    else if (done > 0) toast.warning(`${messages.done(done)}. Not done: ${failed.join(', ')}`, { id: toastId })
    else toast.error(`Nothing changed. Not done: ${failed.join(', ')}`, { id: toastId })
  }, [queryClient])

  // Each order moves to its own next step, so a mixed selection can be advanced together
  const advanceable = useMemo(() => selectedRows.filter((o) => getNextAction(o.status)), [selectedRows])
  const commonNextAction = useMemo(() => {
    const labels = new Set(advanceable.map((o) => getNextAction(o.status)?.label))
    return advanceable.length > 0 && labels.size === 1 ? getNextAction(advanceable[0].status) : null
  }, [advanceable])
  const cancellable = useMemo(() => selectedRows.filter((o) => CANCELLABLE.includes(o.status)), [selectedRows])
  const deletableDrafts = useMemo(() => selectedRows.filter((o) => o.status === 'draft' && !o.invoice_id), [selectedRows])

  const rowActions = useMemo<RowAction<SalesOrder>[]>(() => {
    const actions: RowAction<SalesOrder>[] = []
    const multi = selectedRows.length > 1

    // The next step comes first and stands out
    if (advanceable.length > 0) {
      const Icon = commonNextAction ? (WORKFLOW_ACTION_ICONS[commonNextAction.toStatus] ?? RiBox3Line) : RiArrowRightLine
      const label = commonNextAction?.label ?? 'Move to next step'
      actions.push({
        id: 'workflow-next',
        label: multi ? `${label} (${advanceable.length})` : label,
        icon: Icon,
        primary: true,
        onClick: () => runBulk(advanceable, (o) => salesOrdersApi.updateStatus(o.order_id, getNextAction(o.status)!.toStatus), {
          loading: `Updating ${plural(advanceable.length, 'order')}…`,
          done: (n) => (commonNextAction ? `${plural(n, 'order')} moved to "${commonNextAction.label}"` : `${plural(n, 'order')} moved to the next step`),
        }),
      })
    }

    // One order: edit or continue it, open it, see its invoice
    actions.push({
      id: 'edit-order',
      label: selectedRows[0]?.status === 'draft' ? 'Continue draft' : 'Edit order',
      icon: RiFileEditLine,
      showWhen: 'single',
      primary: advanceable.length === 0,
      onClick: (rows) => {
        const order = rows[0]
        if (order.status === 'draft') navigate(`/sales-orders/assistant?draft=${order.order_id}`)
        else setOrderToEdit(order)
      },
    })
    actions.push({
      id: 'view-details',
      label: 'View details',
      icon: RiEyeLine,
      showWhen: 'single',
      onClick: (rows) => setDetailOrderId(rows[0].order_id),
    })
    if (selectedRows.length === 1 && selectedRows[0]?.invoice_id) {
      actions.push({
        id: 'view-invoice',
        label: 'View invoice',
        icon: RiReceiptLine,
        showWhen: 'single',
        onClick: (rows) => { if (rows[0].invoice_id) navigate(`/invoices?detail=${rows[0].invoice_id}`) },
      })
    }

    // Any number of orders
    actions.push({
      id: 'download-pdf',
      label: multi ? `Download ${selectedRows.length} PDFs` : 'Download PDF',
      icon: RiDownloadLine,
      onClick: (rows) => runBulk(rows, async (o) => {
        downloadFile(await salesOrdersApi.downloadPDF(o.order_id), `${o.order_number}.pdf`)
      }, {
        loading: `Preparing ${plural(rows.length, 'PDF')}…`,
        done: (n) => `${plural(n, 'PDF')} downloaded`,
      }),
    })
    actions.push({
      id: 'export-csv',
      label: multi ? `Export ${selectedRows.length} to spreadsheet` : 'Export to spreadsheet',
      icon: RiFileExcel2Line,
      onClick: (rows) => {
        // A byte-order mark so Excel reads names as UTF-8
        downloadFile(new Blob(['﻿' + ordersCsv(rows)], { type: 'text/csv;charset=utf-8' }), `sales-orders-${localDateString()}.csv`)
        toast.success(`${plural(rows.length, 'order')} exported`)
      },
    })

    // Destructive, last and apart; each asks first and says what it will leave alone
    if (cancellable.length > 0) {
      actions.push({
        id: 'cancel-orders',
        label: multi ? `Cancel ${plural(cancellable.length, 'order')}` : 'Cancel order',
        icon: RiCloseCircleLine,
        destructive: true,
        onClick: async (rows) => {
          const skipped = rows.length - cancellable.length
          const ok = await confirm({
            title: `Cancel ${plural(cancellable.length, 'order')}?`,
            description: `${cancellable.map((o) => o.order_number).join(', ')}: stock goes back and any invoice is voided. This can't be undone.${skipped ? ` ${plural(skipped, 'other selected order')} (draft, delivered or already cancelled) will be left as they are.` : ''}`,
            confirmLabel: `Cancel ${plural(cancellable.length, 'order')}`,
            cancelLabel: 'Keep orders',
            destructive: true,
          })
          if (!ok) return
          runBulk(cancellable, (o) => salesOrdersApi.updateStatus(o.order_id, 'cancelled'), {
            loading: `Cancelling ${plural(cancellable.length, 'order')}…`,
            done: (n) => `${plural(n, 'order')} cancelled`,
          })
        },
      })
    }
    if (deletableDrafts.length > 0) {
      actions.push({
        id: 'delete-drafts',
        label: multi ? `Delete ${plural(deletableDrafts.length, 'draft')}` : 'Delete draft',
        icon: RiDeleteBin6Line,
        destructive: true,
        onClick: async (rows) => {
          const skipped = rows.length - deletableDrafts.length
          const ok = await confirm({
            title: `Delete ${plural(deletableDrafts.length, 'draft')}?`,
            description: `${deletableDrafts.map((o) => o.order_number).join(', ')} and their unsaved progress will be removed permanently. This can't be undone.${skipped ? ` ${plural(skipped, 'other selected order')} that are not drafts will be left as they are.` : ''}`,
            confirmLabel: `Delete ${plural(deletableDrafts.length, 'draft')}`,
            cancelLabel: 'Keep drafts',
            destructive: true,
          })
          if (!ok) return
          runBulk(deletableDrafts, (o) => salesOrdersApi.delete(o.order_id), {
            loading: `Deleting ${plural(deletableDrafts.length, 'draft')}…`,
            done: (n) => `${plural(n, 'draft')} deleted`,
          })
        },
      })
    }

    return actions
  }, [advanceable, cancellable, commonNextAction, confirm, deletableDrafts, navigate, runBulk, selectedRows])

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
          <Button
            type="button"
            variant="link"
            className="group h-auto flex-col items-start gap-0 p-0 text-left font-normal hover:no-underline"
            onClick={(e) => { e.stopPropagation(); setDetailOrderId(row.original.order_id) }}
          >
            <span className="font-medium text-primary group-hover:underline underline-offset-2">
              {row.original.order_number}
            </span>
            <span className="text-xs text-muted-foreground">{row.original.order_id}</span>
          </Button>
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
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => navigate(`/invoices?detail=${row.original.invoice_id}`)}
            >
              View invoice
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
        meta: { sticky: 'right' },
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
                    'font-semibold shadow-none',
                    nextAction.className,
                  )}
                >
                  {isRowPending ? <RiLoader4Line className="animate-spin" /> : <Icon />}
                  {nextAction.label}
                </Button>
              )}

              {/* Drafts pick up in the assistant where they were left */}
              {order.status === 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/sales-orders/assistant?draft=${order.order_id}`)
                  }}
                >
                  <RiFileEditLine />
                  Continue
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
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const blob = await salesOrdersApi.downloadPDF(order.order_id)
                        downloadFile(blob, `${order.order_number}.pdf`)
                        toast.success('PDF downloaded')
                      } catch {
                        toast.error('Failed to download PDF')
                      }
                    }}
                  >
                    <RiDownloadLine className="size-4" />
                    Download PDF
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
                        onClick={() => deleteDraft(order)}
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
    [isAllSelected, isIndeterminate, selectedOrderIds, pendingRowId, navigate, rowStatusMutation, toggleAll, deleteDraft],
  )

  return (
    <div className="space-y-6">
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

      {confirmDialog}

      <FindOrderByReceiptDialog open={findByReceiptOpen} onOpenChange={setFindByReceiptOpen} onFound={setDetailOrderId} />

      {/* Sales order detail sheet */}
      <SalesOrderDetailSheet
        orderId={detailOrderId}
        open={!!detailOrderId}
        onOpenChange={(open) => {
          if (open) return
          setDetailOrderId(null)
          if (searchParams.get('detail')) {
            setSearchParams((prev) => { prev.delete('detail'); return prev }, { replace: true })
          }
        }}
      />

      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">
            Live order processing workspace — track and advance every order through its lifecycle.
          </p>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
        <Button size="sm" variant="outline" className="flex-1 md:flex-none" onClick={() => setFindByReceiptOpen(true)}>
          <RiBarcodeLine className="size-4" />
          Scan invoice
        </Button>
        <Button
          size="sm"
          className="flex-1 md:flex-none"
          onClick={() => navigate('/sales-orders/assistant')}
        >
          <RiAddLine className="size-4" />
          New Sales Order
        </Button>
        </div>
      </section>

      {/* Lifecycle quick-filter tabs */}
      <ToggleGroup
        type="single"
        value={statusFilter || 'all'}
        onValueChange={(value) => {
          if (!value) return
          setStatusFilter(value === 'all' ? '' : (value as SalesOrderStatus))
          setPage(1)
        }}
        aria-label="Filter by status"
        className="w-full justify-start gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {LIFECYCLE_FILTER_TABS.map((tab) => {
          const isActive = (statusFilter === '' && tab.id === 'all') || statusFilter === tab.id
          const isReady = tab.id === 'ready'
          return (
            <ToggleGroupItem
              key={tab.id}
              value={tab.id}
              className={`relative h-auto flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                isActive
                  ? 'border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
                  : isReady && readyCount > 0
                    ? 'border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning hover:bg-warning/15'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-background hover:text-foreground'
              }`}
            >
              {tab.label}
              {isReady && readyCount > 0 && (
                <span className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-warning text-warning-foreground'
                }`}>
                  {readyCount}
                </span>
              )}
              {/* A quiet count: drafts are there when needed, not competing for attention */}
              {tab.id === 'draft' && draftCount > 0 && (
                <span className={`ml-1.5 tabular-nums ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {draftCount}
                </span>
              )}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

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
            isRowActive={(order) => order.order_id === detailOrderId}
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
