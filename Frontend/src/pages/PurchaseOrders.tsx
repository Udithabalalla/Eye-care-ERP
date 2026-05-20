import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
  RiDownloadLine,
  RiEyeLine,
  RiLoader4Line,
  RiMore2Line,
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
import CreatePurchaseOrderAssistant from '@/components/purchase-orders/CreatePurchaseOrderAssistant'
import ReceiveGoodsDialog from '@/components/purchase-orders/ReceiveGoodsDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'

const LIFECYCLE_FILTER_TABS: Array<{ id: PurchaseOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Ordered', label: 'Ordered' },
  { id: 'Received', label: 'Received' },
  { id: 'Closed', label: 'Closed' },
]

const STATUS_FILTER_OPTIONS = LIFECYCLE_FILTER_TABS

const PurchaseOrders = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [invoiceOrder, setInvoiceOrder] = useState<PurchaseOrder | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, pageSize, statusFilter],
    queryFn: () =>
      suppliersApi.getPurchaseOrders({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
      }),
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
        cell: ({ row }) => row.original.items.length,
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
          const nextAction = getPONextAction(order.status)
          const isRowPending = pendingRowId === order.id
          const Icon = nextAction?.icon ?? null

          return (
            <div className="flex items-center gap-1.5 justify-end">
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
    [pendingRowId, rowStatusMutation],
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
            Track and advance every purchase order through its lifecycle.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => setIsCreateOpen(true)}
        >
          <RiAddLine className="size-4" />
          Create PO
        </Button>
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
          if (!open) setDetailOrderId(null)
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
            searchPlaceholder="Search orders…"
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={(order) => setDetailOrderId(order.id)}
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

      {/* Create PO dialog */}
      {isCreateOpen && (
        <CreatePurchaseOrderAssistant
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          }}
        />
      )}

      {/* Receive goods dialog */}
      <ReceiveGoodsDialog
        isOpen={!!receiveOrder}
        order={receiveOrder}
        onClose={() => setReceiveOrder(null)}
        onSuccess={(updatedOrder) => {
          setReceiveOrder(null)
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          // After receiving, prompt invoice creation
          setInvoiceOrder(updatedOrder)
        }}
      />

      {/* Create supplier invoice dialog */}
      <CreateSupplierInvoiceDialog
        isOpen={!!invoiceOrder}
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        onSuccess={async (invoice) => {
          const closingOrderId = invoiceOrder?.id
          setInvoiceOrder(null)
          if (closingOrderId) {
            try {
              await suppliersApi.updatePurchaseOrderStatus(closingOrderId, 'Closed')
            } catch {
              toast.error('Invoice created but failed to close PO — please close it manually.')
            }
          }
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          setPaymentInvoiceId(invoice.id)
        }}
      />

      {/* Record payment dialog — opens automatically after invoice creation */}
      {paymentInvoiceId && (
        <SupplierPaymentForm
          invoiceId={paymentInvoiceId}
          onSuccess={() => {
            setPaymentInvoiceId(null)
            queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          }}
          onCancel={() => setPaymentInvoiceId(null)}
        />
      )}
    </div>
  )
}

export default PurchaseOrders
