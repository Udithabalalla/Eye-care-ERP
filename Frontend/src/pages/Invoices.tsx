import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { Plus, SearchLg, Eye, File06, CurrencyDollar, Download01 } from '@untitledui/icons'
import { Table, TableCard, PaginationPageDefault, Button, Input, BadgeWithDot, Select, SelectItem, Tooltip } from '@/components/ui'
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
import { Key } from 'react-aria-components'
import { useSearchParams } from 'react-router-dom'

const Invoices = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', page, pageSize, statusFilter, search],
    queryFn: () =>
      invoicesApi.getAll({ page, page_size: pageSize, payment_status: statusFilter, search }),
  })

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailOpen(true)
  }

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
      } catch (error) {
        if (!isActive) return
        toast.error('Failed to load invoice details')
        setSearchParams({}, { replace: true })
      }
    }

    openDetail()

    return () => {
      isActive = false
    }
  }, [searchParams, setSearchParams])



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
    } catch (error) {
      toast.error('Failed to download PDF')
    }
  }

  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false)

  const handleViewPrescription = async (prescriptionId: string) => {
    try {
      const prescription = await prescriptionsApi.getById(prescriptionId)
      setSelectedPrescription(prescription)
      setIsPrescriptionModalOpen(true)
    } catch (error) {
      toast.error('Failed to load prescription details')
    }
  }

  const handlePageSizeChange = (key: Key | null) => {
    if (key) {
      setPageSize(Number(key))
      setPage(1)
    }
  }

  const getStatusBadgeColor = (status: string): 'success' | 'warning' | 'error' | 'gray' => {
    switch (status) {
      case 'paid': return 'success'
      case 'partial': return 'warning'
      case 'pending': return 'gray'
      case 'overdue': return 'error'
      default: return 'gray'
    }
  }

  return (
    <div className="space-y-6">
      {/* Table Card with Untitled UI Structure */}
      <TableCard.Root>
        <TableCard.Header
          title="Invoices"
          badge={data?.total || 0}
          description="Manage invoices and billing"
          contentTrailing={
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                aria-label="Search invoices"
                className="w-full sm:w-56"
              />
              <Select
                selectedKey={statusFilter || 'all'}
                onSelectionChange={(key) => setStatusFilter(key === 'all' ? '' : String(key))}
                placeholder="Status"
                aria-label="Filter by status"
                className="w-full sm:w-36"
              >
                <SelectItem id="all">All Status</SelectItem>
                <SelectItem id="paid">Paid</SelectItem>
                <SelectItem id="partial">Partial</SelectItem>
                <SelectItem id="pending">Pending</SelectItem>
                <SelectItem id="overdue">Overdue</SelectItem>
              </Select>
              <Select
                selectedKey={String(pageSize)}
                onSelectionChange={handlePageSizeChange}
                placeholder="Rows"
                aria-label="Rows per page"
                className="w-full sm:w-28"
              >
                <SelectItem id="10">10 rows</SelectItem>
                <SelectItem id="25">25 rows</SelectItem>
                <SelectItem id="50">50 rows</SelectItem>
              </Select>
              <Button onClick={handleAdd} iconLeading={Plus} size="sm">
                Create Invoice
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table aria-label="Invoices table" selectionMode="multiple" selectionBehavior="toggle">
              <Table.Header>
                <Table.Head label="Invoice #" isRowHeader />
                <Table.Head label="Patient" />
                <Table.Head label="Date" />
                <Table.Head label="Amount" />
                <Table.Head label="Paid" />
                <Table.Head label="Balance" />
                <Table.Head label="Status" />
                <Table.Head />
              </Table.Header>
              <Table.Body items={data?.data || []}>
                {(invoice) => (
                  <Table.Row id={invoice.invoice_id}>
                    <Table.Cell>
                      <span className="font-medium text-brand-600">{invoice.invoice_number}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-primary">{invoice.patient_name}</span>
                    </Table.Cell>
                    <Table.Cell>{formatDate(invoice.invoice_date)}</Table.Cell>
                    <Table.Cell>
                      <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-success-600">{formatCurrency(invoice.paid_amount)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-error-600">{formatCurrency(invoice.balance_due)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <BadgeWithDot size="md" color={getStatusBadgeColor(invoice.payment_status)}>
                        {invoice.payment_status}
                      </BadgeWithDot>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title="View invoice">
                          <Button
                            color="link-gray"
                            onClick={() => handleView(invoice)}
                            iconLeading={Eye}
                            aria-label="View"
                            size="sm"
                          />
                        </Tooltip>
                        {invoice.prescription_id && invoice.prescription_id !== 'string' && (
                          <Tooltip title="View prescription">
                            <Button
                              color="link-gray"
                              onClick={() => handleViewPrescription(invoice.prescription_id!)}
                              iconLeading={File06}
                              aria-label="View Prescription"
                              size="sm"
                            />
                          </Tooltip>
                        )}
                        <Tooltip title="Download PDF">
                          <Button
                            color="link-gray"
                            onClick={() => handleDownloadPDF(invoice.invoice_id)}
                            iconLeading={Download01}
                            aria-label="Download PDF"
                            size="sm"
                          />
                        </Tooltip>
                        {invoice.balance_due > 0 && (
                          <Tooltip title="Record payment">
                            <Button
                              color="link-gray"
                              onClick={() => handlePayment(invoice)}
                              iconLeading={CurrencyDollar}
                              aria-label="Payment"
                              size="sm"
                            />
                          </Tooltip>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
            {data && (
              <PaginationPageDefault
                page={page}
                total={data.total_pages}
                onPageChange={setPage}
                className="border-t border-secondary px-6 py-4"
              />
            )}
          </>
        )}
      </TableCard.Root>

      {/* Create/Edit Modal */}
      <InvoiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedInvoice(null)
        }}
        invoice={selectedInvoice}
        onSuccess={() => refetch()}
      />

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false)
            setSelectedInvoice(null)
          }}
          invoice={selectedInvoice}
          onSuccess={() => {
            refetch()
            setIsDetailOpen(false)
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedInvoice(null)
          setSearchParams({}, { replace: true })
        }}
        title="Invoice Details"
        size="xl"
      >
        {selectedInvoice && (
          <InvoiceDetail
            invoice={selectedInvoice}
            onPayment={() => {
              setIsDetailOpen(false)
              handlePayment(selectedInvoice)
            }}
            onDownloadPDF={() => handleDownloadPDF(selectedInvoice.invoice_id)}
          />
        )}
      </Modal>

      {/* Prescription Modal */}
      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => {
          setIsPrescriptionModalOpen(false)
          setSelectedPrescription(null)
        }}
        prescription={selectedPrescription}
        onSuccess={() => { }}
        readOnly={true}
      />
    </div>
  )
}

export default Invoices
