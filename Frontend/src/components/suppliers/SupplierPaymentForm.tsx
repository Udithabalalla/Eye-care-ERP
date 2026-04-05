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
  onSuccess: () => void
  onCancel: () => void
}

const SupplierPaymentForm = ({ payment, onSuccess, onCancel }: SupplierPaymentFormProps) => {
  const queryClient = useQueryClient()
  const { data: invoices } = useQuery({ queryKey: ['supplier-invoices', 'all'], queryFn: () => suppliersApi.getSupplierInvoices({ page: 1, page_size: 100 }) })
  const [form, setForm] = useState<SupplierPaymentFormData>({ invoice_id: '', payment_date: new Date().toISOString(), payment_method: 'cash', amount_paid: 0, notes: '' })

  useEffect(() => {
    if (payment) {
      setForm({
        invoice_id: payment.invoice_id,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        amount_paid: payment.amount_paid,
        notes: payment.notes,
      })
    }
  }, [payment])

  const mutation = useMutation({
    mutationFn: (data: SupplierPaymentFormData) => suppliersApi.createSupplierPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      toast.success('Supplier payment recorded successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to record supplier payment'),
  })

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Record Supplier Payment"
      size="md"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Invoice</label>
          <select className="input" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
            <option value="">Select invoice</option>
            {invoices?.data.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}
          </select>
        </div>
        <Input label="Payment Date" type="datetime-local" value={form.payment_date.slice(0, 16)} onChange={(e) => setForm({ ...form, payment_date: new Date(e.target.value).toISOString() })} />
        <Input label="Payment Method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} />
        <Input label="Amount Paid" type="number" step="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })} />
        <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Modal>
  )
}

export default SupplierPaymentForm
