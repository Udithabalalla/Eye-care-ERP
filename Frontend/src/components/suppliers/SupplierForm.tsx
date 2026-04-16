import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier, SupplierFormData } from '@/types/supplier.types'

const schema = z.object({
  supplier_name: z.string().min(2, 'Supplier name is required'),
  company_name: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface SupplierFormProps {
  supplier?: Supplier | null
  onSuccess: () => void
  onCancel: () => void
}

const SupplierForm = ({ supplier, onSuccess, onCancel }: SupplierFormProps) => {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: supplier ?? { supplier_name: '' },
  })

  useEffect(() => {
    if (supplier) reset(supplier)
  }, [supplier, reset])

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) => suppliersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier created successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to create supplier'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SupplierFormData>) => suppliersApi.update(supplier!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to update supplier'),
  })

  const onSubmit = (data: FormValues) => {
    if (supplier) updateMutation.mutate(data)
    else createMutation.mutate(data as SupplierFormData)
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={supplier ? 'Edit Supplier' : 'Add Supplier'}
      size="lg"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-4 rounded-apple border border-border/70 bg-surface/60 p-4 md:grid-cols-2">
        <Input label="Supplier Name" {...register('supplier_name')} error={errors.supplier_name?.message} />
        <Input label="Company Name" {...register('company_name')} />
        <Input label="Contact Person" {...register('contact_person')} />
        <Input label="Phone" {...register('phone')} />
        <Input label="Email" {...register('email')} />
        <Input label="Payment Terms" {...register('payment_terms')} />
        <Input label="Address" {...register('address')} className="md:col-span-2" />
        <div className="md:col-span-2">
          <Input label="Notes" {...register('notes')} />
        </div>
      </div>
    </Modal>
  )
}

export default SupplierForm
