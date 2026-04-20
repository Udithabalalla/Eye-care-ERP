import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { productsApi } from '@/api/products.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Invoice, InvoiceFormData } from '@/types/invoice.types'
import toast from 'react-hot-toast'
import { Plus, Trash02 } from '@untitledui/icons'
import { useAuthStore } from '@/store/authStore'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { formatCurrency, safeDate } from '@/utils/formatters'
import PrescriptionSelectionModal from './PrescriptionSelectionModal'
import QRScanner from '@/components/common/QRScanner'

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
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)

  const { data: prescriptionsData } = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => prescriptionsApi.getAll({ patient_id: patientId, page: 1, page_size: 100 }),
    enabled: !!patientId,
  })

  // Handle auto-selection or modal trigger
  useEffect(() => {
    if (prescriptionsData?.data && !invoice && !selectedPrescription) {
      if (prescriptionsData.data.length === 1) {
        // Auto-select if only one
        const p = prescriptionsData.data[0]
        setSelectedPrescription(p)
        setValue('prescription_id', p.prescription_id)
      } else if (prescriptionsData.data.length > 1) {
        // Show modal if multiple
        setShowPrescriptionModal(true)
      }
    }
  }, [prescriptionsData, setValue, invoice, selectedPrescription])

  // Handle manual selection from modal
  const handlePrescriptionSelect = (prescription: any) => {
    setSelectedPrescription(prescription)
    setValue('prescription_id', prescription.prescription_id)
    setShowPrescriptionModal(false)
  }

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

  const addScannedProductToInvoice = async (scannedCode: string) => {
    try {
      const product = await productsApi.lookupByCode(scannedCode)

      const existingIndex = items.findIndex((item) => item.product_id === product.product_id)
      if (existingIndex >= 0) {
        const nextQty = (items[existingIndex].quantity || 0) + 1
        setValue(`items.${existingIndex}.quantity`, nextQty)
        setTimeout(() => calculateItemTotal(existingIndex), 0)
      } else {
        append({
          product_id: product.product_id,
          product_name: product.name,
          sku: product.sku,
          quantity: 1,
          unit_price: product.selling_price,
          discount: 0,
          tax: 0,
          total: product.selling_price,
        })
      }

      toast.success(`${product.name} added to invoice`)
      setShowBarcodeScanner(false)
    } catch (error) {
      toast.error('Scanned product not found')
    }
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
        {selectedPrescription && (
          <div className="col-span-1 md:col-span-3 bg-brand-50 dark:bg-brand-950 p-3 rounded-md flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-brand-700 dark:text-brand-300 font-medium">Linked Prescription:</span>
              <span className="text-sm text-brand-600 dark:text-brand-400">
                {new Date(selectedPrescription.prescription_date).toLocaleDateString()} -
                {selectedPrescription.diagnosis}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-brand-500 bg-brand-100 dark:bg-brand-900 px-2 py-1 rounded">
                {prescriptionsData?.data?.length === 1 ? 'Auto-linked' : 'Selected'}
              </span>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(true)}
                className="text-xs text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-200 underline"
              >
                Change
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Invoice Date *
          </label>
          <input type="date" {...register('invoice_date')} className="input" />
          {errors.invoice_date && (
            <p className="text-sm text-error-600 mt-1">{errors.invoice_date.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Due Date *
          </label>
          <input type="date" {...register('due_date')} className="input" />
          {errors.due_date && (
            <p className="text-sm text-error-600 mt-1">{errors.due_date.message}</p>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Items</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              className="btn-secondary"
            >
              Scan Barcode
            </button>
            <button type="button" onClick={addItem} className="btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border border-border rounded-lg">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Total
                  </label>
                  <input
                    type="number"
                    {...register(`items.${index}.total`)}
                    className="input text-sm bg-secondary"
                    readOnly
                  />
                </div>

                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="btn-danger p-2"
                  >
                    <Trash02 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {errors.items && (
          <p className="text-sm text-error-600 mt-2">{errors.items.message}</p>
        )}
      </div>

      {/* Totals */}
      <div className="bg-secondary p-4 rounded-lg">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Discount:</span>
            <span className="font-medium text-error-600">-{formatCurrency(totalDiscount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Tax:</span>
            <span className="font-medium">{formatCurrency(totalTax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total Amount:</span>
            <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Notes</label>
        <input {...register('notes')} className="input" />
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

      <PrescriptionSelectionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        prescriptions={prescriptionsData?.data || []}
        onSelect={handlePrescriptionSelect}
        selectedId={selectedPrescription?.prescription_id}
      />

      <QRScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={addScannedProductToInvoice}
      />
    </form>
  )
}

export default InvoiceForm






