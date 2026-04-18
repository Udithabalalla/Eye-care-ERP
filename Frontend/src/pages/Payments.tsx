import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem, Button } from '@/components/ui'
import Loading from '@/components/common/Loading'
import Modal from '@/components/common/Modal'
import { paymentsApi } from '@/api/payments.api'
import { invoicesApi } from '@/api/invoices.api'
import { PaymentMethod } from '@/types/common.types'
import { LedgerReferenceType, Payment } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

const Payments = () => {
  const queryClient = useQueryClient()
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    reference_id: '',
    amount: '',
    payment_method: PaymentMethod.CASH,
    payment_date: new Date().toISOString().split('T')[0],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['payments', referenceType],
    queryFn: () => paymentsApi.getAll({ page: 1, page_size: 100, reference_type: referenceType || undefined }),
  })

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['payments-invoice-lookup'],
    queryFn: () => invoicesApi.getAll({ page: 1, page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(form.amount)
      if (!form.reference_id) {
        throw new Error('Invoice is required')
      }
      if (!numericAmount || numericAmount <= 0) {
        throw new Error('Payment amount must be greater than 0')
      }

      return paymentsApi.create({
        amount: numericAmount,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference_type: 'INVOICE',
        reference_id: form.reference_id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Payment recorded successfully')
      setIsModalOpen(false)
      setForm({
        reference_id: '',
        amount: '',
        payment_method: PaymentMethod.CASH,
        payment_date: new Date().toISOString().split('T')[0],
      })
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to record payment')
    },
  })

  const selectedInvoice = useMemo(
    () => (invoicesData?.data || []).find((invoice) => invoice.invoice_id === form.reference_id),
    [invoicesData, form.reference_id]
  )

  const rows = (data?.data || []).filter((payment) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [payment.payment_id, payment.reference_id, payment.created_by].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Payments"
          badge={rows.length}
          description="Unified customer and supplier payments"
          contentTrailing={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search payments..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <Select selectedKey={referenceType || 'all'} onSelectionChange={(key) => setReferenceType(key === 'all' ? '' : String(key) as LedgerReferenceType)} placeholder="Reference Type">
                <SelectItem id="all">All References</SelectItem>
                <SelectItem id="INVOICE">Invoice</SelectItem>
                <SelectItem id="SALES_ORDER">Sales Order</SelectItem>
                <SelectItem id="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem id="SUPPLIER_INVOICE">Supplier Invoice</SelectItem>
              </Select>
              <Button onClick={() => setIsModalOpen(true)} iconLeading={Plus} size="sm">
                Record Payment
              </Button>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Payments table">
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Payment ID" />
              <Table.Head label="Reference" />
              <Table.Head label="Amount" />
              <Table.Head label="Method" />
              <Table.Head label="Transaction" />
            </Table.Header>
            <Table.Body items={rows as Payment[]}>
              {(payment) => (
                <Table.Row id={payment.payment_id}>
                  <Table.Cell>{formatDate(payment.payment_date)}</Table.Cell>
                  <Table.Cell>{payment.payment_id}</Table.Cell>
                  <Table.Cell>{payment.reference_type} / {payment.reference_id}</Table.Cell>
                  <Table.Cell>{formatCurrency(payment.amount)}</Table.Cell>
                  <Table.Cell>{payment.payment_method}</Table.Cell>
                  <Table.Cell>{payment.transaction_id || '-'}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Payment"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Invoice *</label>
            <select
              className="input w-full"
              value={form.reference_id}
              onChange={(event) => {
                const invoiceId = event.target.value
                const invoice = (invoicesData?.data || []).find((item) => item.invoice_id === invoiceId)
                setForm((current) => ({
                  ...current,
                  reference_id: invoiceId,
                  amount: invoice ? String(invoice.balance_due || '') : current.amount,
                }))
              }}
              disabled={isInvoicesLoading}
            >
              <option value="">Select invoice</option>
              {(invoicesData?.data || []).map((invoice) => (
                <option key={invoice.invoice_id} value={invoice.invoice_id}>
                  {invoice.invoice_number} - {invoice.patient_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Amount *</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className="input w-full"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            />
            {selectedInvoice && (
              <p className="text-xs text-tertiary mt-1">
                Balance due: {formatCurrency(selectedInvoice.balance_due)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Payment Method *</label>
            <select
              className="input w-full"
              value={form.payment_method}
              onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value as PaymentMethod }))}
            >
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.CARD}>Card</option>
              <option value={PaymentMethod.UPI}>UPI</option>
              <option value={PaymentMethod.NETBANKING}>Net Banking</option>
              <option value={PaymentMethod.INSURANCE}>Insurance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Payment Date *</label>
            <input
              type="date"
              className="input w-full"
              value={form.payment_date}
              onChange={(event) => setForm((current) => ({ ...current, payment_date: event.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button color="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending}>
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Payments