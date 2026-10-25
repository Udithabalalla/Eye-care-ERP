import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type SortingState } from '@tanstack/react-table'
import { RiAddLine, RiAlertLine, RiEyeLine, RiMoneyDollarCircleLine, RiMore2Line, RiShoppingCartLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { cn } from '@/lib/utils'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, SupplierInvoice } from '@/types/supplier.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { SupplierInvoiceDetailSheet } from '@/components/supplier-invoices/SupplierInvoiceDetailSheet'
import { SupplierInvoiceStatusBadge } from '@/components/supplier-invoices/SupplierInvoiceStatusBadge'
import { daysOverdue, dueText } from '@/utils/supplierInvoice'
import { AddSupplierInvoiceDialog } from '@/components/supplier-invoices/AddSupplierInvoiceDialog'
import { RecordSupplierPaymentDialog } from '@/components/purchase-orders/RecordSupplierPaymentDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'

type Tab = 'all' | 'Unpaid' | 'Partial' | 'overdue' | 'Paid'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'Unpaid', label: 'Unpaid' },
  { id: 'Partial', label: 'Part paid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'Paid', label: 'Paid' },
]

const SupplierInvoices = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('status') as Tab) || 'all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sorting, setSorting] = useState<SortingState>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [payInvoice, setPayInvoice] = useState<SupplierInvoice | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [orderToInvoice, setOrderToInvoice] = useState<PurchaseOrder | null>(null)

  // Deep link from a purchase order or payment: /supplier-invoices?detail=SINV000012
  const urlDetail = searchParams.get('detail')
  useEffect(() => {
    if (urlDetail) setDetailId(urlDetail)
  }, [urlDetail])

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-invoices', 'page', page, pageSize, tab, deferredSearch],
    queryFn: () =>
      suppliersApi.getSupplierInvoices({
        page,
        page_size: pageSize,
        status: tab === 'all' || tab === 'overdue' ? undefined : tab,
        overdue: tab === 'overdue' || undefined,
        search: deferredSearch.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  })
  const invoices = data?.data ?? []

  // What's owed, at a glance (everything still to pay, not just this page)
  const { data: owing } = useQuery({
    queryKey: ['supplier-invoices', 'owing-summary'],
    queryFn: async () => {
      const [unpaid, partial] = await Promise.all([
        suppliersApi.getSupplierInvoices({ page: 1, page_size: 100, status: 'Unpaid' }),
        suppliersApi.getSupplierInvoices({ page: 1, page_size: 100, status: 'Partial' }),
      ])
      const rows = [...unpaid.data, ...partial.data]
      const overdue = rows.filter((inv) => daysOverdue(inv) > 0)
      const balance = (list: SupplierInvoice[]) => list.reduce((sum, inv) => sum + (inv.balance_due ?? inv.total_amount), 0)
      return { count: rows.length, total: balance(rows), overdueCount: overdue.length, overdueTotal: balance(overdue) }
    },
    staleTime: 30_000,
  })

  const pickTab = (next: Tab) => {
    setTab(next)
    setPage(1)
  }

  const openPurchaseOrder = (orderId: string) => navigate(`/purchase-orders?detail=${orderId}`)

  const columns = useMemo<ColumnDef<SupplierInvoice>[]>(
    () => [
      {
        accessorKey: 'invoice_number',
        header: 'Invoice',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-primary">{row.original.invoice_number}</span>
            {row.original.matching_status === 'Flagged' && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <RiAlertLine className="size-3" /> Doesn’t match order
              </span>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.supplier_name || row.original.supplier_id}</span>,
      },
      {
        id: 'order',
        header: 'Purchase order',
        cell: ({ row }) =>
          row.original.purchase_order_id ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={(event) => {
                event.stopPropagation()
                openPurchaseOrder(row.original.purchase_order_id!)
              }}
            >
              {row.original.purchase_order_id}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">No order</span>
          ),
      },
      {
        accessorKey: 'invoice_date',
        header: 'Invoice date',
        cell: ({ row }) => formatDate(row.original.invoice_date),
      },
      {
        id: 'due',
        header: 'Due',
        cell: ({ row }) => {
          const invoice = row.original
          if (!invoice.due_date) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex flex-col">
              <span>{formatDate(invoice.due_date)}</span>
              {invoice.status !== 'Paid' && (
                <span className={cn('text-[11px]', daysOverdue(invoice) > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>{dueText(invoice)}</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total_amount)}</span>,
      },
      {
        id: 'balance',
        header: 'To pay',
        cell: ({ row }) => {
          const balance = row.original.balance_due ?? row.original.total_amount
          return balance > 0 ? (
            <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(balance)}</span>
          ) : (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <SupplierInvoiceStatusBadge invoice={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const invoice = row.original
          const balance = invoice.balance_due ?? invoice.total_amount
          return (
            <div className="flex items-center justify-end gap-1.5">
              {balance > 0 && (
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2.5 text-xs font-semibold shadow-none"
                  onClick={(event) => {
                    event.stopPropagation()
                    setPayInvoice(invoice)
                  }}
                >
                  <RiMoneyDollarCircleLine className="size-3" />
                  Pay
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="data-[state=open]:bg-muted" aria-label="More actions" onClick={(e) => e.stopPropagation()}>
                    <RiMore2Line className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setDetailId(invoice.id)}>
                    <RiEyeLine className="size-4" />
                    View details
                  </DropdownMenuItem>
                  {invoice.purchase_order_id && (
                    <DropdownMenuItem onClick={() => openPurchaseOrder(invoice.purchase_order_id!)}>
                      <RiShoppingCartLine className="size-4" />
                      Open purchase order
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Supplier Invoices</h1>
          <p className="text-sm text-muted-foreground">Bills from your suppliers — what you owe, and when it’s due.</p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => setAddOpen(true)}>
          <RiAddLine className="size-4" />
          Add invoice
        </Button>
      </section>

      {/* What's owed */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => pickTab('all')}
          className="rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
        >
          <p className="text-xs text-muted-foreground">Still to pay</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{owing ? formatCurrency(owing.total) : '…'}</p>
          <p className="text-xs text-muted-foreground">{owing ? `${owing.count} bill${owing.count === 1 ? '' : 's'} open` : ' '}</p>
        </button>
        <button
          type="button"
          onClick={() => pickTab('overdue')}
          className={cn(
            'rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-destructive/40',
            owing?.overdueCount ? 'border-red-200 dark:border-red-900' : 'border-border',
          )}
        >
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', owing?.overdueCount && 'text-destructive')}>{owing ? formatCurrency(owing.overdueTotal) : '…'}</p>
          <p className="text-xs text-muted-foreground">{owing ? (owing.overdueCount ? `${owing.overdueCount} past their due date` : 'Nothing overdue') : ' '}</p>
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => pickTab(t.id)}
            className={cn(
              'flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SupplierInvoiceDetailSheet
        invoiceId={detailId}
        open={!!detailId}
        onOpenChange={(open) => {
          if (open) return
          setDetailId(null)
          if (searchParams.get('detail')) {
            setSearchParams((prev) => { prev.delete('detail'); return prev }, { replace: true })
          }
        }}
      />

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Invoices</CardTitle>
              <CardDescription>Click a row for the bill, its payments and the order it belongs to.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{data?.total ?? 0} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={invoices}
            sorting={sorting}
            onSortingChange={setSorting}
            globalFilter={search}
            onGlobalFilterChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            loading={isLoading}
            searchPlaceholder="Search invoice, order or supplier…"
            className="px-6"
            onRowClick={(invoice) => setDetailId(invoice.id)}
            isRowActive={(invoice) => invoice.id === detailId}
            emptyMessage={tab === 'overdue' ? 'Nothing overdue.' : 'No supplier invoices found.'}
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

      <RecordSupplierPaymentDialog open={!!payInvoice} onClose={() => setPayInvoice(null)} supplierInvoice={payInvoice} />

      <AddSupplierInvoiceDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPickOrder={(order) => {
          setAddOpen(false)
          setOrderToInvoice(order)
        }}
        onCreated={(invoice) => {
          setAddOpen(false)
          setDetailId(invoice.id)
        }}
      />

      {/* Invoice against a received order — lines are matched to what arrived */}
      <CreateSupplierInvoiceDialog
        isOpen={!!orderToInvoice}
        order={orderToInvoice}
        onClose={() => setOrderToInvoice(null)}
        onSuccess={(invoice) => {
          setOrderToInvoice(null)
          queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
          setDetailId(invoice.id)
        }}
      />
    </div>
  )
}

export default SupplierInvoices
