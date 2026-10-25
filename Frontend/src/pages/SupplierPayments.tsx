import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState } from '@tanstack/react-table'
import { RiAddLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierPayment } from '@/types/supplier.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { RecordSupplierPaymentDialog } from '@/components/purchase-orders/RecordSupplierPaymentDialog'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  'bank-transfer': 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  upi: 'UPI',
}

const SupplierPayments = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [recordOpen, setRecordOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-payments', 'page', page, pageSize],
    queryFn: () => suppliersApi.getSupplierPayments({ page, page_size: pageSize }),
    placeholderData: keepPreviousData,
  })

  // The list endpoint has no search, so this narrows the current page
  const query = search.trim().toLowerCase()
  const payments = (data?.data ?? []).filter((p) =>
    !query || [p.invoice_number, p.supplier_name, p.purchase_order_id, p.reference_number, p.payment_method].join(' ').toLowerCase().includes(query),
  )

  // A payment opens the bill it settled; an advance without one opens its order
  const openPayment = (payment: SupplierPayment) =>
    navigate(payment.invoice_id ? `/supplier-invoices?detail=${payment.invoice_id}` : `/purchase-orders?detail=${payment.purchase_order_id}`)

  const columns = useMemo<ColumnDef<SupplierPayment>[]>(
    () => [
      {
        accessorKey: 'payment_date',
        header: 'Paid on',
        cell: ({ row }) => formatDate(row.original.payment_date),
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.supplier_name ?? '—'}</span>,
      },
      {
        id: 'invoice',
        header: 'Invoice',
        cell: ({ row }) =>
          row.original.invoice_id ? (
            <div className="flex flex-col">
              <span className="font-medium text-primary">{row.original.invoice_number || row.original.invoice_id}</span>
              {row.original.is_advance && <span className="text-[11px] text-sky-700 dark:text-sky-300">Paid ahead</span>}
            </div>
          ) : (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">Advance — no invoice yet</span>
          ),
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
                navigate(`/purchase-orders?detail=${row.original.purchase_order_id}`)
              }}
            >
              {row.original.purchase_order_id}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'method',
        header: 'Paid by',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{METHOD_LABELS[row.original.payment_method] ?? row.original.payment_method}</span>
            {row.original.reference_number && <span className="text-xs text-muted-foreground">{row.original.reference_number}</span>}
          </div>
        ),
      },
      {
        accessorKey: 'amount_paid',
        header: 'Amount',
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatCurrency(row.original.amount_paid)}</span>,
      },
    ],
    [navigate],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Supplier Payments</h1>
          <p className="text-sm text-muted-foreground">Every payment made to a supplier, and the bill it settled.</p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => setRecordOpen(true)}>
          <RiAddLine className="size-4" />
          Record payment
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Payments</CardTitle>
              <CardDescription>Click a payment to open its invoice — or the order, for an advance.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{data?.total ?? 0} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={payments}
            sorting={sorting}
            onSortingChange={setSorting}
            globalFilter={search}
            onGlobalFilterChange={setSearch}
            loading={isLoading}
            searchPlaceholder="Search this page…"
            className="px-6"
            onRowClick={openPayment}
            emptyMessage="No supplier payments yet."
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

      <RecordSupplierPaymentDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
    </div>
  )
}

export default SupplierPayments
