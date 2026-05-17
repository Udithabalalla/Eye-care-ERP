import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { productsApi } from '@/api/products.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Invoice, InvoiceFormData } from '@/types/invoice.types'
import toast from 'react-hot-toast'
import { RiAddLine, RiDeleteBinLine } from '@remixicon/react'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100 }),
  })

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })

  const form = useForm<InvoiceFormValues>({
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
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          items: [],
        },
  })

  const { control, watch, setValue } = form
  const patientId = watch('patient_id')
  const items = watch('items')

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)

  const { data: prescriptionsData } = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => prescriptionsApi.getAll({ patient_id: patientId, page: 1, page_size: 100 }),
    enabled: !!patientId,
  })

  useEffect(() => {
    if (prescriptionsData?.data && !invoice && !selectedPrescription) {
      if (prescriptionsData.data.length === 1) {
        const p = prescriptionsData.data[0]
        setSelectedPrescription(p)
        setValue('prescription_id', p.prescription_id)
      } else if (prescriptionsData.data.length > 1) {
        setShowPrescriptionModal(true)
      }
    }
  }, [prescriptionsData, setValue, invoice, selectedPrescription])

  const handlePrescriptionSelect = (prescription: any) => {
    setSelectedPrescription(prescription)
    setValue('prescription_id', prescription.prescription_id)
    setShowPrescriptionModal(false)
  }

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0)
  const totalTax = items.reduce((sum, item) => sum + (item.tax || 0), 0)

  const addItem = () => {
    append({ product_id: '', product_name: '', sku: '', quantity: 1, unit_price: 0, discount: 0, tax: 0, total: 0 })
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
    } catch {
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
      setTimeout(() => calculateItemTotal(index), 0)
    }
  }

  const calculateItemTotal = (index: number) => {
    const item = items[index]
    if (item) {
      const sub = item.quantity * item.unit_price
      const discountAmount = item.discount || 0
      const taxAmount = ((sub - discountAmount) * (item.tax || 0)) / 100
      setValue(`items.${index}.total`, parseFloat((sub - discountAmount + taxAmount).toFixed(2)))
    }
  }

  useEffect(() => {
    items.forEach((item, index) => {
      if (item.quantity && item.unit_price) {
        const sub = item.quantity * item.unit_price
        const discountAmount = item.discount || 0
        const taxAmount = ((sub - discountAmount) * (item.tax || 0)) / 100
        const calculatedTotal = parseFloat((sub - discountAmount + taxAmount).toFixed(2))
        if (item.total !== calculatedTotal) {
          setValue(`items.${index}.total`, calculatedTotal)
        }
      }
    })
  }, [items.map((i) => `${i.quantity}-${i.unit_price}-${i.discount}-${i.tax}`).join(',')])

  const createMutation = useMutation({
    mutationFn: (data: InvoiceFormData) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to create invoice'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InvoiceFormData>) => invoicesApi.update(invoice!.invoice_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice updated successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to update invoice'),
  })

  const onSubmit = (data: InvoiceFormValues) => {
    if (invoice) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as InvoiceFormData)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Header fields */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">Invoice Details</p>
            <p className="text-sm text-muted-foreground mt-0.5">Patient, dates, and linked prescription.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={control}
              name="patient_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Patient <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <SearchableLOV
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={patients?.data?.map((p: any): LOVOption => ({
                        value: p.patient_id,
                        label: p.name,
                        subtitle: p.patient_id,
                      })) || []}
                      placeholder="Select patient"
                      error={fieldState.error?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="invoice_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {selectedPrescription && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Linked Prescription</Badge>
                <span className="text-muted-foreground">
                  {new Date(selectedPrescription.prescription_date).toLocaleDateString()} — {selectedPrescription.diagnosis}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPrescriptionModal(true)}
              >
                Change
              </Button>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Items</p>
              <p className="text-sm text-muted-foreground mt-0.5">Products included in this invoice.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowBarcodeScanner(true)}>
                Scan Barcode
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <RiAddLine className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-border p-4">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3">
                    <FormLabel className="text-xs mb-1 block">Product</FormLabel>
                    <Controller
                      control={control}
                      name={`items.${index}.product_id`}
                      render={({ field: f }) => (
                        <Select
                          value={f.value}
                          onValueChange={(v) => {
                            f.onChange(v)
                            handleProductChange(index, v)
                          }}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.data?.map((p: any) => (
                              <SelectItem key={p.product_id} value={p.product_id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormLabel className="text-xs mb-1 block">Quantity</FormLabel>
                    <Controller
                      control={control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          min="1"
                          className="text-sm"
                          {...f}
                          onChange={(e) => f.onChange(parseInt(e.target.value))}
                        />
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormLabel className="text-xs mb-1 block">Unit Price</FormLabel>
                    <Controller
                      control={control}
                      name={`items.${index}.unit_price`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          step="0.01"
                          className="text-sm"
                          {...f}
                          onChange={(e) => f.onChange(parseFloat(e.target.value))}
                        />
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormLabel className="text-xs mb-1 block">Discount</FormLabel>
                    <Controller
                      control={control}
                      name={`items.${index}.discount`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          step="0.01"
                          className="text-sm"
                          {...f}
                          onChange={(e) => f.onChange(parseFloat(e.target.value))}
                        />
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormLabel className="text-xs mb-1 block">Total</FormLabel>
                    <Controller
                      control={control}
                      name={`items.${index}.total`}
                      render={({ field: f }) => (
                        <Input
                          type="number"
                          className="text-sm bg-secondary"
                          readOnly
                          {...f}
                        />
                      )}
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => remove(index)}
                    >
                      <RiDeleteBinLine className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {form.formState.errors.items && (
            <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>
          )}

          {/* Totals */}
          <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Discount</span>
              <span className="font-medium text-destructive">-{formatCurrency(totalDiscount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Tax</span>
              <span className="font-medium">{formatCurrency(totalTax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold pt-1">
              <span>Total Amount</span>
              <span className="text-primary">{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <FormField
          control={control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Input placeholder="Optional notes about this invoice..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
          </Button>
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
    </Form>
  )
}

export default InvoiceForm
