import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { invoicesApi } from '@/api/invoices.api'
import {
  RiAddLine,
  RiSearchLine,
  RiMore2Line,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
import InvoiceModal from '@/components/invoices/InvoiceModal'
import PaymentModal from '@/components/invoices/PaymentModal'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import Modal from '@/components/common/Modal'
import InvoiceDetail from '@/components/invoices/InvoiceDetail'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { downloadFile } from '@/utils/helpers'
import { Invoice } from '@/types/invoice.types'
import { prescriptionsApi } from '@/api/prescriptions.api'
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', page, pageSize, statusFilter, search],
    queryFn: () =>
      invoicesApi.getAll({ page, page_size: pageSize, payment_status: statusFilter, search }),
  })

  useEffect(() => {
    const detailId = searchParams.get('detail')
    if (!detailId) return
    let isActive = true
    const openDetail = async () => {
      try {
        const invoice = await invoicesApi.getById(detailId)
        if (!isActive) return
        setSelectedInvoice(invoice)
        setIsDetailOpen(true)
      } catch {
        if (!isActive) return
        toast.error('Failed to load invoice details')
        setSearchParams({}, { replace: true })
      }
    }
    openDetail()
    return () => { isActive = false }
  }, [searchParams, setSearchParams])

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailOpen(true)
  }

  const handleAdd = () => {
    setSelectedInvoice(null)
    setIsModalOpen(true)
  }

  const handlePayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsPaymentModalOpen(true)
  }

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const blob = await invoicesApi.downloadPDF(invoiceId)
      downloadFile(blob, `invoice-${invoiceId}.pdf`)
      toast.success('PDF downloaded successfully')
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
      toast.error('Failed to load prescription details')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">Invoices</CardTitle>
                <Badge variant="secondary">{data?.total || 0}</Badge>
              </div>
              <CardDescription className="mt-1">Manage invoices and billing</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-full sm:w-56"
                  aria-label="Search invoices"
                />
              </div>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
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
                <SelectTrigger className="w-full sm:w-28" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAdd}>
                <RiAddLine className="size-4" />
                Create Invoice
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12"><Loading /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data || []).map((invoice) => (
                      <TableRow key={invoice.invoice_id}>
                        <TableCell>
                          <span className="font-medium text-primary">{invoice.invoice_number}</span>
                        </TableCell>
                        <TableCell>{invoice.patient_name}</TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(invoice.total_amount)}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(invoice.paid_amount)}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(invoice.balance_due)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[invoice.payment_status] ?? 'outline'} className="capitalize">
                            {invoice.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleView(invoice)}>
                                View Details
                              </DropdownMenuItem>

                              {invoice.prescription_id && invoice.prescription_id !== 'string' && (
                                <DropdownMenuItem onClick={() => handleViewPrescription(invoice.prescription_id!)}>
                                  View Prescription
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem onClick={() => handleDownloadPDF(invoice.invoice_id)}>
                                Download PDF
                              </DropdownMenuItem>

                              {invoice.balance_due > 0 && (
                                <DropdownMenuItem onClick={() => handlePayment(invoice)}>
                                  Record Payment
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.data || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No invoices found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {data && data.total_pages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page === data.total_pages} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
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
          onSuccess={() => { refetch(); setIsDetailOpen(false) }}
        />
      )}

      <Modal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedInvoice(null); setSearchParams({}, { replace: true }) }}
        title="Invoice Details"
        size="xl"
      >
        {selectedInvoice && (
          <InvoiceDetail
            invoice={selectedInvoice}
            onPayment={() => { setIsDetailOpen(false); handlePayment(selectedInvoice) }}
            onDownloadPDF={() => handleDownloadPDF(selectedInvoice.invoice_id)}
          />
        )}
      </Modal>

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
