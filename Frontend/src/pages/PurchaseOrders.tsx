import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
  RiDownloadLine,
  RiEyeLine,
  RiFileCopyLine,
  RiFileEditLine,
  RiLoader4Line,
  RiMoneyDollarCircleLine,
  RiMore2Line,
  RiTruckLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, PurchaseOrderStatus } from '@/types/supplier.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { DataTable } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { PurchaseOrderStatusBadge } from '@/components/purchase-orders/PurchaseOrderStatusBadge'
import {
  getPONextAction,
  getPOCommonAction,
} from '@/components/purchase-orders/PurchaseOrderWorkflowActions'
import { PurchaseOrderDetailSheet } from '@/components/purchase-orders/PurchaseOrderDetailSheet'
import ReceiveGoodsDialog from '@/components/purchase-orders/ReceiveGoodsDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'
import { RecordSupplierPaymentDialog, type PayableSupplierInvoice } from '@/components/purchase-orders/RecordSupplierPaymentDialog'
import { SendPurchaseOrderDialog } from '@/components/purchase-orders/SendPurchaseOrderDialog'

const LIFECYCLE_FILTER_TABS: Array<{ id: PurchaseOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Ordered', label: 'Ordered' },
  { id: 'Partially Received', label: 'Partially Received' },
  { id: 'Received', label: 'Received' },
  { id: 'Closed', label: 'Closed' },
]

const STATUS_FILTER_OPTIONS = LIFECYCLE_FILTER_TABS

const PurchaseOrders = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  // Deep links (e.g. after creating reorder drafts) can pre-select a status
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStatus = searchParams.get('status') as PurchaseOrderStatus | null
  useEffect(() => {
    if (urlStatus) setStatusFilter(urlStatus)
  }, [urlStatus])
  // Deep link (e.g. straight after saving an order): /purchase-orders?detail=PO000123
  const urlDetail = searchParams.get('detail')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  useEffect(() => {
    if (urlDetail) setDetailOrderId(urlDetail)
  }, [urlDetail])
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [invoiceOrder, setInvoiceOrder] = useState<PurchaseOrder | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [payInvoice, setPayInvoice] = useState<PayableSupplierInvoice | null>(null)
  const [sendOrder, setSendOrder] = useState<PurchaseOrder | null>(null)

  const deferredSearch = useDeferredValue(search)
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, pageSize, statusFilter, deferredSearch],
    queryFn: () =>
      suppliersApi.getPurchaseOrders({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        search: deferredSearch.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const orders = data?.data || []

  const rowStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
      suppliersApi.updatePurchaseOrderStatus(id, status),
    onMutate: ({ id }) => setPendingRowId(id),
    onSettled: () => setPendingRowId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
  })

  const selectedRows = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.id)),
    [orders, selectedOrderIds],
  )

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const commonNextAction = useMemo(() => getPOCommonAction(selectedRows), [selectedRows])

  const rowActions = useMemo(() => {
    const actions = []

    if (commonNextAction && !commonNextAction.requiresDialog) {
      const Icon = commonNextAction.icon
      actions.push({
        id: `workflow-${commonNextAction.toStatus}`,
        label: commonNextAction.label,
        icon: Icon,
        primary: true,
        showWhen: 'any' as const,
        onClick: (rows: PurchaseOrder[]) => {
          const promises = rows.map((r) =>
            suppliersApi.updatePurchaseOrderStatus(r.id, commonNextAction.toStatus),
          )
          toast.promise(Promise.all(promises), {
            loading: `Updating ${rows.length > 1 ? `${rows.length} orders` : 'order'}…`,
            success: () => {
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
              setSelectedOrderIds([])
              return `Moved to "${commonNextAction.label}"`
            },
            error: 'Some updates failed',
          })
        },
      })
    }

    return actions
  }, [commonNextAction, queryClient])

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Order #',
        cell: ({ row }) => (
          <button
            className="flex flex-col text-left group"
            onClick={(e) => {
              e.stopPropagation()
              setDetailOrderId(row.original.id)
            }}
          >
            <span className="font-medium text-primary group-hover:underline underline-offset-2">
              {row.original.id}
            </span>
          </button>
        ),
      },
      {
        accessorKey: 'supplier_information',
        header: 'Supplier',
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">
              {row.original.supplier_information?.supplier_name || row.original.supplier_id}
            </span>
            {row.original.supplier_information?.company_name && (
              <span className="text-xs text-muted-foreground truncate">
                {row.original.supplier_information.company_name}
              </span>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PurchaseOrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => {
          const items = row.original.items
          const first = items[0]?.item_name
          return (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-foreground">{first ?? `${items.length} item${items.length === 1 ? '' : 's'}`}</span>
              {first && items.length > 1 && <span className="text-xs text-muted-foreground">+{items.length - 1} more</span>}
            </div>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatCurrency(row.original.total_amount)}
          </span>
        ),
      },
      {
        id: 'payment',
        header: 'Supplier invoice',
        enableSorting: false,
        cell: ({ row }) => {
          const invoice = row.original.supplier_invoice
          if (!invoice) {
            const ahead = row.original.advance_paid ?? 0
            return (
              <div className="flex flex-col">
                {['Received', 'Partially Received'].includes(row.original.status)
                  ? <span className="text-xs text-amber-600 dark:text-amber-400">Not invoiced yet</span>
                  : !ahead && <span className="text-xs text-muted-foreground">—</span>}
                {ahead > 0 && <span className="text-xs text-sky-700 dark:text-sky-300">{formatCurrency(ahead)} paid ahead</span>}
              </div>
            )
          }
          return (
            <button
              type="button"
              className="flex flex-col text-left"
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/supplier-invoices?detail=${invoice.id}`)
              }}
            >
              <span className="text-sm text-primary hover:underline">{invoice.invoice_number}</span>
              <span className={cn('text-xs', invoice.balance_due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {invoice.balance_due > 0 ? `${formatCurrency(invoice.balance_due)} to pay` : 'Paid'}
              </span>
            </button>
          )
        },
      },
      {
        accessorKey: 'order_date',
        header: 'Order Date',
        cell: ({ row }) => formatDate(row.original.order_date),
      },
      {
        accessorKey: 'expected_delivery_date',
        header: 'Expected Delivery',
        cell: ({ row }) =>
          row.original.expected_delivery_date
            ? formatDate(row.original.expected_delivery_date)
            : '—',
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const order = row.original
          const invoice = order.supplier_invoice
          // Once the supplier's bill is in, paying it is what's next
          const owing = invoice && invoice.balance_due > 0
          const nextAction = owing ? null : getPONextAction(order.status)
          const isRowPending = pendingRowId === order.id
          const Icon = nextAction?.icon ?? null

          return (
            <div className="flex items-center gap-1.5 justify-end">
              {owing && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPayInvoice({
                      id: invoice.id,
                      invoice_number: invoice.invoice_number,
                      total_amount: invoice.total_amount,
                      paid_amount: invoice.paid_amount,
                      purchase_order_id: order.id,
                      supplier_name: order.supplier_information?.supplier_name,
                    })
                  }}
                  className="h-7 gap-1 border-violet-600 bg-violet-600 px-2.5 text-xs font-semibold text-white shadow-none hover:bg-violet-700"
                >
                  <RiMoneyDollarCircleLine className="size-3" />
                  Pay Supplier
                </Button>
              )}
              {/* Inline workflow action for non-dialog transitions */}
              {nextAction && Icon && !nextAction.requiresDialog && (
                <Button
                  size="sm"
                  disabled={isRowPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    rowStatusMutation.mutate(
                      { id: order.id, status: nextAction.toStatus },
                      {
                        onSuccess: () =>
                          toast.success(`"${order.id}" → ${nextAction.label}`),
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

              {/* Dialog-triggering actions shown as button */}
              {nextAction && Icon && nextAction.requiresDialog && (
                <Button
                  size="sm"
                  disabled={isRowPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (nextAction.toStatus === 'Received') setReceiveOrder(order)
                    else if (nextAction.toStatus === 'Closed') setInvoiceOrder(order)
                    else if (nextAction.toStatus === 'Ordered') setSendOrder(order)
                  }}
                  className={cn(
                    'h-7 gap-1 px-2.5 text-xs font-semibold shadow-none',
                    nextAction.className,
                  )}
                >
                  <Icon className="size-3" />
                  {nextAction.label}
                </Button>
              )}

              {/* Ellipsis menu */}
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
                  <DropdownMenuItem onClick={() => setDetailOrderId(order.id)}>
                    <RiEyeLine className="size-4" />
                    View Details
                  </DropdownMenuItem>
                  {order.status === 'Draft' && (
                    <DropdownMenuItem onClick={() => navigate(`/purchase-orders/new?draft=${order.id}`)}>
                      <RiFileEditLine className="size-4" />
                      Edit Draft
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate(`/purchase-orders/new?copy=${order.id}`)}>
                    <RiFileCopyLine className="size-4" />
                    Order Again
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const blob = await suppliersApi.downloadPurchaseOrderPdf(order.id)
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `${order.id}.pdf`
                        document.body.appendChild(link)
                        link.click()
                        link.remove()
                        window.URL.revokeObjectURL(url)
                        toast.success('PDF downloaded')
                      } catch {
                        toast.error('Failed to download PDF')
                      }
                    }}
                  >
                    <RiDownloadLine className="size-4" />
                    Download PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [pendingRowId, rowStatusMutation, navigate],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            From ordering to paying the supplier — every step happens on the order.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => navigate('/inventory/receiving?tab=quick')}>
            <RiTruckLine className="size-4" />
            Receive without a PO
          </Button>
          <Button size="sm" className="w-full md:w-auto" onClick={() => navigate('/purchase-orders/new')}>
            <RiAddLine className="size-4" />
            Create PO
          </Button>
        </div>
      </section>

      {/* Lifecycle quick-filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LIFECYCLE_FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatusFilter(tab.id === 'all' ? '' : (tab.id as PurchaseOrderStatus))
              setPage(1)
            }}
            className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              (statusFilter === '' && tab.id === 'all') || statusFilter === tab.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Detail sheet */}
      <PurchaseOrderDetailSheet
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

      {/* Main table card */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Order Records</CardTitle>
              <CardDescription>
                Click a row to view details. Inline action buttons advance each order.
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
                setStatusFilter(value === 'all' ? '' : (value as PurchaseOrderStatus))
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
            searchPlaceholder="Search PO number, supplier or item…"
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={(order) => setDetailOrderId(order.id)}
            isRowActive={(order) => order.id === detailOrderId}
            onClearSelection={() => setSelectedOrderIds([])}
            emptyMessage="No purchase orders found."
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

      {/* Receive goods dialog */}
      <ReceiveGoodsDialog
        isOpen={!!receiveOrder}
        order={receiveOrder}
        onClose={() => setReceiveOrder(null)}
        onSuccess={(updatedOrder) => {
          setReceiveOrder(null)
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          // Everything's in — the supplier's invoice is next (a part delivery waits for the rest)
          if (updatedOrder?.status === 'Received') setInvoiceOrder(updatedOrder)
        }}
      />

      {/* Create supplier invoice dialog */}
      <CreateSupplierInvoiceDialog
        isOpen={!!invoiceOrder}
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        onSuccess={(invoice) => {
          // The order closes itself once this invoice is paid in full
          setInvoiceOrder(null)
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          // Advances already paid on the order count towards this invoice
          if ((invoice.balance_due ?? invoice.total_amount) > 0) setPayInvoice(invoice)
          else toast.success(`${invoice.invoice_number} is already covered by the advance`)
        }}
      />

      {/* Paying the supplier — opens straight after the invoice is recorded */}
      <RecordSupplierPaymentDialog open={!!payInvoice} onClose={() => setPayInvoice(null)} supplierInvoice={payInvoice} />

      <SendPurchaseOrderDialog order={sendOrder} open={!!sendOrder} onClose={() => setSendOrder(null)} />
    </div>
  )
}

export default PurchaseOrders
