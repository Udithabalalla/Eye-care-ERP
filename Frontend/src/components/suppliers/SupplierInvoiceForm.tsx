import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice, SupplierInvoiceFormData } from '@/types/supplier.types'

interface SupplierInvoiceFormProps {
  invoice?: SupplierInvoice | null
  onSuccess: () => void
  onCancel: () => void
}

const SupplierInvoiceForm = ({ invoice, onSuccess, onCancel }: SupplierInvoiceFormProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const [form, setForm] = useState<SupplierInvoiceFormData>({ supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString(), total_amount: 0, status: 'Unpaid' })

  useEffect(() => {
    if (invoice) {
      setForm({
        supplier_id: invoice.supplier_id,
        purchase_order_id: invoice.purchase_order_id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        total_amount: invoice.total_amount,
        due_date: invoice.due_date,
        status: invoice.status,
      })
    }
  }, [invoice])

  const createMutation = useMutation({
    mutationFn: (data: SupplierInvoiceFormData) => suppliersApi.createSupplierInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success('Supplier invoice created successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to create supplier invoice'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SupplierInvoiceFormData>) => suppliersApi.updateSupplierInvoice(invoice!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success('Supplier invoice updated successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to update supplier invoice'),
  })

  const save = () => {
    if (!form.supplier_id) { toast.error('Please select a supplier'); return }
    if (!form.invoice_number) { toast.error('Invoice number is required'); return }
    const payload = {
      ...form,
      due_date: form.due_date || undefined,
    }
    if (invoice) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={invoice ? 'Edit Supplier Invoice' : 'Add Supplier Invoice'}
      size="lg"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Supplier</label>
          <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Select supplier</option>
            {suppliers?.data.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}
          </select>
        </div>
        <Input label="Invoice Number" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
        <Input label="Invoice Date" type="datetime-local" value={form.invoice_date.slice(0, 16)} onChange={(e) => setForm({ ...form, invoice_date: new Date(e.target.value).toISOString() })} />
        <Input label="Due Date" type="datetime-local" value={form.due_date ? form.due_date.slice(0, 16) : ''} onChange={(e) => setForm({ ...form, due_date: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
        <Input label="Total Amount" type="number" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} />
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

export default SupplierInvoiceForm
