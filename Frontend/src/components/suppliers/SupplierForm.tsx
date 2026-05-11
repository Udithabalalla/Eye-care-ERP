import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier, SupplierFormData } from '@/types/supplier.types'

interface SupplierFormProps {
  supplier?: Supplier | null
  onSuccess: () => void
  onCancel: () => void
}

const SupplierForm = ({ supplier, onSuccess, onCancel }: SupplierFormProps) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SupplierFormData>({
    supplier_name: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '',
    notes: '',
  })

  useEffect(() => {
    if (!supplier) return
    setForm({
      supplier_name: supplier.supplier_name || '',
      company_name: supplier.company_name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
    })
  }, [supplier])

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) => suppliersApi.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier created successfully')
      onSuccess()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to create supplier'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SupplierFormData>) => suppliersApi.update(supplier!.id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated successfully')
      onSuccess()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to update supplier'),
  })

  const save = () => {
    const payload: SupplierFormData = {
      supplier_name: form.supplier_name.trim(),
      company_name: form.company_name?.trim() || undefined,
      contact_person: form.contact_person?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
      payment_terms: form.payment_terms?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }

    if (!payload.supplier_name) {
      toast.error('Supplier name is required')
      return
    }

    if (supplier) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={supplier ? 'Edit Supplier' : 'Add Supplier'}
      size="lg"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button onClick={save} isLoading={isSaving}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Supplier Name" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
        <Input label="Company Name" value={form.company_name ?? ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        <Input label="Contact Person" value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
        <Input label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Payment Terms" value={form.payment_terms ?? ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
        <div className="md:col-span-2">
          <Input label="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Notes</label>
          <textarea
            className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  )
}

export default SupplierForm

