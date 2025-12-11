import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { productsApi } from '@/api/products.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Invoice, InvoiceFormData } from '@/types/invoice.types'
import { PaymentMethod } from '@/types/common.types'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { safeDate } from '@/utils/formatters'

const invoiceItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  product_name: z.string(),
  sku: z.string(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0),
})

const invoiceSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  invoice_date: z.string(),
  due_date: z.string(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  prescription_id: z.string().optional(),
  notes: z.string().optional(),
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

interface InvoiceFormProps {
  invoice?: Invoice | null
  onSuccess: () => void
  onCancel: () => void
}

const InvoiceForm = ({ invoice, onSuccess, onCancel }: InvoiceFormProps) => {
  const queryClient = useQueryClient()
  const { } = useAuthStore()

  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100 }),
  })

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: invoice
      ? {
        patient_id: invoice.patient_id,
        invoice_date: safeDate(invoice.invoice_date),
        due_date: safeDate(invoice.due_date),
        items: invoice.items,
        payment_method: invoice.payment_method,
        prescription_id: invoice.prescription_id === 'string' ? undefined : invoice.prescription_id,
        notes: invoice.notes || '',
      }
      : {
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        items: [],
      },
  })

  const patientId = watch('patient_id')

  const { data: latestPrescription } = useQuery({
    queryKey: ['latest-prescription', patientId],
    queryFn: () => prescriptionsApi.getAll({ patient_id: patientId, page: 1, page_size: 1 }),
    enabled: !!patientId,
  })

  useEffect(() => {
    if (latestPrescription?.data?.[0] && !invoice) {
      const pid = latestPrescription.data[0].prescription_id
      if (pid && pid !== 'string') {
        setValue('prescription_id', pid)
      }
    }
  }, [latestPrescription, setValue, invoice])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const items = watch('items')

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0)
  const totalTax = items.reduce((sum, item) => sum + (item.tax || 0), 0)
  const totalAmount = subtotal

  const addItem = () => {
    append({
      product_id: '',
      product_name: '',
      sku: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0,
      total: 0,
    })
  }

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.data.find((p) => p.product_id === productId)
    if (product) {
      setValue(`items.${index}.product_id`, product.product_id)
      setValue(`items.${index}.product_name`, product.name)
      setValue(`items.${index}.sku`, product.sku)
      setValue(`items.${index}.unit_price`, product.selling_price)
      // Trigger recalculation
      setTimeout(() => calculateItemTotal(index), 0)
    }
  }

  const calculateItemTotal = (index: number) => {
    const item = items[index]
    if (item) {
      const subtotal = item.quantity * item.unit_price
      const discountAmount = item.discount || 0
      const taxAmount = ((subtotal - discountAmount) * (item.tax || 0)) / 100
      const total = subtotal - discountAmount + taxAmount
      setValue(`items.${index}.total`, parseFloat(total.toFixed(2)))
    }
  }

  // Watch for changes in items and recalculate totals
  useEffect(() => {
    items.forEach((item, index) => {
      if (item.quantity && item.unit_price) {
        const subtotal = item.quantity * item.unit_price
        const discountAmount = item.discount || 0
        const taxAmount = ((subtotal - discountAmount) * (item.tax || 0)) / 100
        const total = subtotal - discountAmount + taxAmount
        const calculatedTotal = parseFloat(total.toFixed(2))

        // Only update if the calculated total is different from current total
        if (item.total !== calculatedTotal) {
          setValue(`items.${index}.total`, calculatedTotal)
        }
      }
    })
  }, [items.map(i => `${i.quantity}-${i.unit_price}-${i.discount}-${i.tax}`).join(',')])

  const createMutation = useMutation({
    mutationFn: (data: InvoiceFormData) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to create invoice')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InvoiceFormData>) =>
      invoicesApi.update(invoice!.invoice_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice updated successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update invoice')
    },
  })

  const onSubmit = (data: InvoiceFormValues) => {
    if (invoice) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as InvoiceFormData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Invoice Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SearchableLOV
          label="Patient"
          required
          value={watch('patient_id')}
          onChange={(value) => setValue('patient_id', value)}
          options={
            patients?.data?.map((patient: any): LOVOption => ({
              value: patient.patient_id,
              label: patient.name,
              subtitle: patient.patient_id,
            })) || []
          }
          placeholder="Select patient"
          error={errors.patient_id?.message}
        />

        {/* Linked Prescription Display */}
        {latestPrescription?.data?.[0] && (
          <div className="col-span-1 md:col-span-3 bg-blue-50 p-3 rounded-md flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-blue-700 font-medium">Linked Prescription:</span>
              <span className="text-sm text-blue-600">
                {new Date(latestPrescription.data[0].prescription_date).toLocaleDateString()} -
                {latestPrescription.data[0].diagnosis}
              </span>
            </div>
            <span className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded">
              Auto-linked
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invoice Date *
          </label>
          <input type="date" {...register('invoice_date')} className="input" />
          {errors.invoice_date && (
            <p className="text-sm text-red-600 mt-1">{errors.invoice_date.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date *
          </label>
          <input type="date" {...register('due_date')} className="input" />
          {errors.due_date && (
            <p className="text-sm text-red-600 mt-1">{errors.due_date.message}</p>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Items</h3>
          <button type="button" onClick={addItem} className="btn-secondary">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Product
                  </label>
                  <select
                    {...register(`items.${index}.product_id`)}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Select product</option>
                    {products?.data?.map((product: any) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    className="input text-sm"
                    min="1"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Discount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`items.${index}.discount`, { valueAsNumber: true })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Total
                  </label>
                  <input
                    type="number"
                    {...register(`items.${index}.total`)}
                    className="input text-sm bg-gray-50"
                    readOnly
                  />
                </div>

                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="btn-danger p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {errors.items && (
          <p className="text-sm text-red-600 mt-2">{errors.items.message}</p>
        )}
      </div>

      {/* Totals */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Discount:</span>
            <span className="font-medium text-red-600">-${totalDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Tax:</span>
            <span className="font-medium">${totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total Amount:</span>
            <span className="text-primary-600">${totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Method & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <select {...register('payment_method')} className="input">
            <option value="">Select payment method</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="insurance">Insurance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <input {...register('notes')} className="input" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

export default InvoiceForm
