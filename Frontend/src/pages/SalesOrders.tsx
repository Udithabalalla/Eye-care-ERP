import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
  RiArrowRightSLine,
  RiFileEditLine,
  RiFileTextLine,
  RiReceiptLine,
} from '@remixicon/react'
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
import { RiMore2Line } from '@remixicon/react'

const DraftCard = ({ order, onContinue }: { order: SalesOrder; onContinue: () => void }) => (
  <div className="flex flex-shrink-0 flex-col gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30 w-56">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">{order.order_number}</p>
        <p className="text-sm font-medium text-foreground truncate mt-0.5">{order.patient_name || 'Unknown patient'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
      </div>
      <RiFileEditLine className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
    </div>
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

const statusVariant: Record<SalesOrderStatus, 'secondary' | 'outline' | 'destructive' | 'default'> = {
  draft: 'outline',
  confirmed: 'secondary',
  in_production: 'secondary',
  ready: 'default',
  completed: 'default',
  cancelled: 'destructive',
}

const statusOptions: Array<{ id: SalesOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All Statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const SalesOrders = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])

  const { data: draftsData } = useQuery({
    queryKey: ['sales-orders-drafts'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 10, status: 'draft' }),
  })
  const drafts = draftsData?.data || []

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
    toggleOne(order.order_id, !selectedOrderIds.includes(order.order_id))
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const rowActions: RowAction<SalesOrder>[] = [
    {
      id: 'edit-order',
      label: 'Edit / Continue',
      icon: RiFileEditLine,
      onClick: (rows) => navigate(`/sales-orders/assistant?draft=${rows[0].order_id}`),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'view-invoice',
      label: 'View Invoice',
      icon: RiReceiptLine,
      onClick: (rows) => {
        if (rows[0].invoice_id) navigate(`/invoices?detail=${rows[0].invoice_id}`)
      },
      showWhen: 'single',
    },
  ]

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
          <div className="flex flex-col">
            <span className="font-medium text-primary">{row.original.order_number}</span>
            <span className="text-xs text-muted-foreground">{row.original.order_id}</span>
          </div>
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
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status]} className="capitalize">
            {row.original.status.replace('_', ' ')}
          </Badge>
        ),
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
        cell: ({ row }) => formatDate(row.original.created_at),
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
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="data-[state=open]:bg-muted"
                aria-label="Open order actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => navigate(`/sales-orders/assistant?draft=${row.original.order_id}`)}
              >
                <RiFileEditLine className="size-4" />
                Edit / Continue
              </DropdownMenuItem>
              {row.original.invoice_id && (
                <DropdownMenuItem
                  onClick={() => navigate(`/invoices?detail=${row.original.invoice_id}`)}
                >
                  <RiReceiptLine className="size-4" />
                  View Invoice
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAllSelected, isIndeterminate, selectedOrderIds],
  )

  return (
    <div className="space-y-6">
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
              />
            ))}
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">
            View all created sales orders and open the sales order assistant.
          </p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => navigate('/sales-orders/assistant')}>
          <RiAddLine className="size-4" />
          New Sales Order
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Order Records</CardTitle>
              <CardDescription>Search, filter, and manage all sales orders.</CardDescription>
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
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
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
            onGlobalFilterChange={(value) => { setSearch(value); setPage(1) }}
            loading={isLoading}
            searchPlaceholder="Search orders..."
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
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              totalItems={data.total}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesOrders
