import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierPayment, SupplierPaymentFormData } from '@/types/supplier.types'

interface SupplierPaymentFormProps {
  payment?: SupplierPayment | null
  invoiceId?: string
  onSuccess: () => void
  onCancel: () => void
}

const SupplierPaymentForm = ({ payment, invoiceId, onSuccess, onCancel }: SupplierPaymentFormProps) => {
  const queryClient = useQueryClient()
  const { data: invoices } = useQuery({ queryKey: ['supplier-invoices', 'all'], queryFn: () => suppliersApi.getSupplierInvoices({ page: 1, page_size: 100 }) })
  const [form, setForm] = useState<SupplierPaymentFormData>({ invoice_id: invoiceId, payment_date: new Date().toISOString(), payment_method: 'cash', amount_paid: 0, reference_number: '', notes: '' })

  useEffect(() => {
    if (payment) {
      setForm({
        invoice_id: payment.invoice_id,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        amount_paid: payment.amount_paid,
        reference_number: payment.reference_number,
        notes: payment.notes,
      })
      return
    }
    if (invoiceId) {
      setForm((current) => ({ ...current, invoice_id: invoiceId }))
    }
  }, [payment, invoiceId])

  const mutation = useMutation({
    mutationFn: (data: SupplierPaymentFormData) => {
      if (invoiceId) {
        const { invoice_id: _ignoredInvoiceId, ...payload } = data
        return suppliersApi.recordSupplierInvoicePayment(invoiceId, payload)
      }
      return suppliersApi.createSupplierPayment(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success('Supplier payment recorded successfully')
      onSuccess()
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || 'Failed to record supplier payment'
      toast.error(msg)
    },
  })

  const handleSave = () => {
    if (!invoiceId && !form.invoice_id) { toast.error('Please select an invoice'); return }
    if (form.amount_paid <= 0) { toast.error('Amount paid must be greater than 0'); return }
    mutation.mutate(form)
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Record Supplier Payment"
      size="md"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} isLoading={mutation.isPending}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-4">
        {!invoiceId && (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Invoice</label>
            <select className="input" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
              <option value="">Select invoice</option>
              {invoices?.data.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}
            </select>
          </div>
        )}
        <Input label="Payment Date" type="datetime-local" value={form.payment_date.slice(0, 16)} onChange={(e) => setForm({ ...form, payment_date: new Date(e.target.value).toISOString() })} />
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Payment Method</label>
          <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="insurance">Insurance</option>
          </select>
        </div>
        <Input label="Amount Paid" type="number" step="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })} />
        <Input label="Reference Number" value={form.reference_number || ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
        <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Modal>
  )
}

export default SupplierPaymentForm

