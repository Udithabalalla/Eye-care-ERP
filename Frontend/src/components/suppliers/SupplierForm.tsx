import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier, SupplierFormData } from '@/types/supplier.types'

interface SupplierFormProps {
  supplier?: Supplier | null
  onSuccess: () => void
  onCancel: () => void
}

const supplierSchema = z.object({
  supplier_name: z.string().trim().min(1, 'Supplier name is required'),
  company_name: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  address: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
})
type SupplierFormValues = z.infer<typeof supplierSchema>

const defaultsFor = (supplier?: Supplier | null): SupplierFormValues => ({
  supplier_name: supplier?.supplier_name || '',
  company_name: supplier?.company_name || '',
  contact_person: supplier?.contact_person || '',
  phone: supplier?.phone || '',
  email: supplier?.email || '',
  address: supplier?.address || '',
  payment_terms: supplier?.payment_terms || '',
  notes: supplier?.notes || '',
})

const TEXT_FIELDS: Array<{ name: keyof SupplierFormValues; label: string; type?: string; wide?: boolean }> = [
  { name: 'supplier_name', label: 'Supplier Name *' },
  { name: 'company_name', label: 'Company Name' },
  { name: 'contact_person', label: 'Contact Person' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'payment_terms', label: 'Payment Terms' },
  { name: 'address', label: 'Address', wide: true },
]

const SupplierForm = ({ supplier, onSuccess, onCancel }: SupplierFormProps) => {
  const queryClient = useQueryClient()
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: defaultsFor(supplier),
  })

  useEffect(() => {
    form.reset(defaultsFor(supplier))
  }, [supplier, form])

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

  // Empty optional fields are sent as undefined, as before
  const save = (values: SupplierFormValues) => {
    const optional = (value?: string) => value?.trim() || undefined
    const payload: SupplierFormData = {
      supplier_name: values.supplier_name.trim(),
      company_name: optional(values.company_name),
      contact_person: optional(values.contact_person),
      phone: optional(values.phone),
      email: optional(values.email),
      address: optional(values.address),
      payment_terms: optional(values.payment_terms),
      notes: optional(values.notes),
    }
    if (supplier) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)}>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              {TEXT_FIELDS.map(({ name, label, type, wide }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className={wide ? 'md:col-span-2' : undefined}>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input type={type} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[90px]" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default SupplierForm
