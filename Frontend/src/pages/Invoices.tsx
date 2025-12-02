import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { Plus, Search, Eye } from 'lucide-react'
import Table from '@/components/common/Table'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import InvoiceModal from '@/components/invoices/InvoiceModal'
import PaymentModal from '@/components/invoices/PaymentModal'
import Modal from '@/components/common/Modal'
import InvoiceDetail from '@/components/invoices/InvoiceDetail'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { getStatusColor, downloadFile } from '@/utils/helpers'
import { Invoice } from '@/types/invoice.types'
import toast from 'react-hot-toast'

const Invoices = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', page, pageSize, statusFilter],
    queryFn: () =>
      invoicesApi.getAll({ page, page_size: pageSize, payment_status: statusFilter }),
  })

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailOpen(true)
  }

  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsModalOpen(true)
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
    } catch (error) {
      toast.error('Failed to download PDF')
    }
  }

  const columns = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (invoice: Invoice) => (
        <span className="font-medium text-primary-600">{invoice.invoice_number}</span>
      ),
    },
    {
      key: 'patient_name',
      header: 'Patient',
      render: (invoice: Invoice) => invoice.patient_name,
    },
    {
      key: 'invoice_date',
      header: 'Date',
      render: (invoice: Invoice) => formatDate(invoice.invoice_date),
    },
    {
      key: 'total_amount',
      header: 'Amount',
      render: (invoice: Invoice) => formatCurrency(invoice.total_amount),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      render: (invoice: Invoice) => (
        <span className="text-green-600">{formatCurrency(invoice.paid_amount)}</span>
      ),
    },
    {
      key: 'balance_due',
      header: 'Balance',
      render: (invoice: Invoice) => (
        <span className="text-red-600">{formatCurrency(invoice.balance_due)}</span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (invoice: Invoice) => (
        <span className={`badge ${getStatusColor(invoice.payment_status)}`}>
          {invoice.payment_status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice: Invoice) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleView(invoice)
          }}
          className="text-primary-600 hover:text-primary-700"
        >
          <Eye className="w-5 h-5" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Invoices</h1>
          <p className="text-text-secondary mt-1">Manage invoices and billing</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by invoice number or patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-48"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table data={data?.data || []} columns={columns} onRowClick={handleView} />
            {data && (
              <Pagination
                currentPage={page}
                totalPages={data.total_pages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={data.total}
              />
            )}
          </>
        )}
      </div>

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
    </div>
  )
}

export default Invoices
