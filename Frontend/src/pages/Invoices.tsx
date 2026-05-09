import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { invoicesApi } from '@/api/invoices.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import {
  RiAddLine,
  RiDownloadLine,
  RiEyeLine,
  RiFileTextLine,
  RiMoneyDollarCircleLine,
  RiMore2Line,
  RiReceiptLine,
} from '@remixicon/react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import InvoiceModal from '@/components/invoices/InvoiceModal'
import PaymentModal from '@/components/invoices/PaymentModal'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import InvoiceDetail from '@/components/invoices/InvoiceDetail'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { downloadFile } from '@/utils/helpers'
import { Invoice } from '@/types/invoice.types'
import { Prescription } from '@/types/prescription.types'
import toast from 'react-hot-toast'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  pending: 'outline',
  overdue: 'destructive',
}

const Invoices = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', page, pageSize, statusFilter, search],
    queryFn: () =>
      invoicesApi.getAll({ page, page_size: pageSize, payment_status: statusFilter, search }),
  })

  const invoices = data?.data || []

  const isAllSelected =
    invoices.length > 0 && invoices.every((inv) => selectedInvoiceIds.includes(inv.invoice_id))
  const isIndeterminate =
    selectedInvoiceIds.some((id) => invoices.some((inv) => inv.invoice_id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => invoices.filter((inv) => selectedInvoiceIds.includes(inv.invoice_id)),
    [invoices, selectedInvoiceIds],
  )

  useEffect(() => {
    const detailId = searchParams.get('detail')
    if (!detailId) return
    let active = true
    invoicesApi.getById(detailId).then((inv) => {
      if (!active) return
      setSelectedInvoice(inv)
      setIsDetailOpen(true)
    }).catch(() => {
      if (!active) return
      toast.error('Failed to load invoice details')
      setSearchParams({}, { replace: true })
    })
    return () => { active = false }
  }, [searchParams, setSearchParams])

  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailOpen(true)
  }

  const closeDetail = () => {
    setIsDetailOpen(false)
    setSelectedInvoice(null)
    setSearchParams({}, { replace: true })
  }

  const openPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsPaymentModalOpen(true)
  }

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const blob = await invoicesApi.downloadPDF(invoiceId)
      downloadFile(blob, `invoice-${invoiceId}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  const handleViewPrescription = async (prescriptionId: string) => {
    try {
      const prescription = await prescriptionsApi.getById(prescriptionId)
      setSelectedPrescription(prescription)
      setIsPrescriptionModalOpen(true)
    } catch {
      toast.error('Failed to load prescription')
    }
  }

  const toggleAll = (checked: boolean) => {
    const visibleIds = invoices.map((inv) => inv.invoice_id)
    if (checked) {
      setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      setSelectedInvoiceIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    }
  }

  const toggleOne = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds((prev) =>
      checked ? [...prev, invoiceId] : prev.filter((id) => id !== invoiceId),
    )
  }

  const handleRowClick = (invoice: Invoice) => {
    toggleOne(invoice.invoice_id, !selectedInvoiceIds.includes(invoice.invoice_id))
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const rowActions: RowAction<Invoice>[] = [
    {
      id: 'view-details',
      label: 'View Details',
      icon: RiFileTextLine,
      onClick: (rows) => openDetail(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'record-payment',
      label: 'Record Payment',
      icon: RiMoneyDollarCircleLine,
      onClick: (rows) => openPayment(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'download-pdf',
      label: 'Download PDF',
      icon: RiDownloadLine,
      onClick: (rows) => handleDownloadPDF(rows[0].invoice_id),
      showWhen: 'single',
    },
    {
      id: 'view-prescription',
      label: 'View Prescription',
      icon: RiEyeLine,
      onClick: (rows) => {
        const rx = rows[0].prescription_id
        if (rx && rx !== 'string') handleViewPrescription(rx)
        else toast.error('No prescription linked to this invoice')
      },
      showWhen: 'single',
    },
  ]

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all invoices"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.invoice_number}`}
            checked={selectedInvoiceIds.includes(row.original.invoice_id)}
            onCheckedChange={(checked) => toggleOne(row.original.invoice_id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'invoice_number',
        header: 'Invoice #',
        cell: ({ row }) => (
          <span className="font-medium text-primary">{row.original.invoice_number}</span>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{row.original.patient_name}</span>
            {row.original.patient_phone && (
              <span className="text-xs text-muted-foreground">{row.original.patient_phone}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'invoice_date',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.invoice_date),
      },
      {
        accessorKey: 'due_date',
        header: 'Due Date',
        cell: ({ row }) => formatDate(row.original.due_date),
      },
      {
        accessorKey: 'total_amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatCurrency(row.original.total_amount)}</span>
        ),
      },
      {
        accessorKey: 'paid_amount',
        header: 'Paid',
        cell: ({ row }) => (
          <span className="tabular-nums text-green-600 dark:text-green-400">
            {formatCurrency(row.original.paid_amount)}
          </span>
        ),
      },
      {
        accessorKey: 'balance_due',
        header: 'Balance',
        cell: ({ row }) => (
          <span className="tabular-nums text-destructive">
            {formatCurrency(row.original.balance_due)}
          </span>
        ),
      },
      {
        accessorKey: 'payment_status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.payment_status] ?? 'outline'} className="capitalize">
            {row.original.payment_status}
          </Badge>
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
                aria-label="Open invoice actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => openDetail(row.original)}>
                <RiFileTextLine className="size-4" />
                View Details
              </DropdownMenuItem>
              {row.original.balance_due > 0 && (
                <DropdownMenuItem onClick={() => openPayment(row.original)}>
                  <RiMoneyDollarCircleLine className="size-4" />
                  Record Payment
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleDownloadPDF(row.original.invoice_id)}>
                <RiDownloadLine className="size-4" />
                Download PDF
              </DropdownMenuItem>
              {row.original.prescription_id && row.original.prescription_id !== 'string' && (
                <DropdownMenuItem onClick={() => handleViewPrescription(row.original.prescription_id!)}>
                  <RiEyeLine className="size-4" />
                  View Prescription
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAllSelected, isIndeterminate, selectedInvoiceIds],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage invoices and billing.</p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => { setSelectedInvoice(null); setIsModalOpen(true) }}>
          <RiAddLine className="size-4" />
          Create Invoice
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Invoice Records</CardTitle>
              <CardDescription>Search, filter, and manage all invoices.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => { setStatusFilter(value === 'all' ? '' : value); setPage(1) }}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}
            >
              <SelectTrigger className="w-full sm:w-32" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={invoices}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => { setSearch(value); setPage(1) }}
            loading={isLoading}
            searchPlaceholder="Search invoices..."
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={handleRowClick}
            onClearSelection={() => setSelectedInvoiceIds([])}
            emptyMessage="No invoices found."
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

      <InvoiceModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedInvoice(null) }}
        invoice={selectedInvoice}
        onSuccess={() => refetch()}
      />

      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => { setIsPaymentModalOpen(false); setSelectedInvoice(null) }}
          invoice={selectedInvoice}
          onSuccess={() => { refetch(); setIsPaymentModalOpen(false) }}
        />
      )}

      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!open) closeDetail() }}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiReceiptLine className="size-5 text-primary" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceDetail
              invoice={selectedInvoice}
              onPayment={() => { closeDetail(); openPayment(selectedInvoice) }}
              onDownloadPDF={() => handleDownloadPDF(selectedInvoice.invoice_id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => { setIsPrescriptionModalOpen(false); setSelectedPrescription(null) }}
        prescription={selectedPrescription}
        onSuccess={() => {}}
        readOnly={true}
      />
    </div>
  )
}

export default Invoices
