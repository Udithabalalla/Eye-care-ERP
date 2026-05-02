import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  RiAlertLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiEyeLine,
  RiScanLine,
  RiDeleteBin6Line,
  RiTimeLine,
  RiCheckLine,
  RiUserLine,
  RiFileTextLine,
  RiBox3Line,
  RiSparklingLine,
  RiReceiptLine,
  RiShieldCheckLine,
  RiAddLine,
  RiLoader4Line,
} from '@remixicon/react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'
import SearchableLOV from '@/components/common/SearchableLOV'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { productsApi } from '@/api/products.api'
import { salesOrdersApi } from '@/api/erp.api'
import { useOtherExpenses } from '@/hooks/useOtherExpenses'
import { useLensMaster } from '@/hooks/useLensMaster'
import { Invoice } from '@/types/invoice.types'
import { Gender, ProductCategory } from '@/types/common.types'
import { Patient } from '@/types/patient.types'
import { Prescription } from '@/types/prescription.types'
import { Product } from '@/types/product.types'
import { SalesOrderItem } from '@/types/erp.types'
import { formatCurrency } from '@/utils/formatters'
import { calculateLineTotal, calculateOrderTotals, roundCurrency } from '@/utils/salesOrderCalculations'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { usePatientSearch } from '@/hooks/usePatientSearch'
import { usePrescriptionFetch } from '@/hooks/usePrescriptionFetch'

// ─── Schema ───────────────────────────────────────────────────────────────────

const phoneDigits = (value: string) => value.replace(/\D/g, '')
const safeText = (value: unknown) => (typeof value === 'string' ? value : '')

const optionalNumber = () =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const n = Number(value)
    return Number.isNaN(n) ? undefined : n
  }, z.number().min(0).optional())

const requiredMoney = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}, z.number().min(0))

const eyeMeasurementSchema = z.object({
  sphere: requiredMoney,
  cylinder: requiredMoney,
  axis: requiredMoney,
  add: requiredMoney,
  pd: requiredMoney,
})

const expenseRowSchema = z.object({
  expenseTypeId: z.string().optional().default(''),
  expenseTypeName: z.string().optional().default(''),
  qty: requiredMoney.default(1),
  unitCost: requiredMoney.default(0),
  discount: requiredMoney.default(0),
  total: requiredMoney.default(0),
})

const salesOrderIntakeSchema = z
  .object({
    patient: z.object({
      existingId: z.string().optional().default(''),
      newData: z.object({
        fullName: z.string().min(2, 'Full name is required'),
        phone: z.string().min(10, 'Phone is required'),
        age: optionalNumber(),
        gender: z.nativeEnum(Gender).optional(),
        address: z.string().optional().default(''),
      }),
    }),
    prescription: z.object({
      existingId: z.string().optional().default(''),
      newData: z.object({
        prescriptionDate: z.string().optional().default(''),
        validUntil: z.string().optional().default(''),
        diagnosis: z.string().optional().default(''),
        notes: z.string().optional().default(''),
        rightEye: eyeMeasurementSchema,
        leftEye: eyeMeasurementSchema,
      }),
    }),
    salesOrder: z.object({
      isOld: z.boolean().default(false),
      deliveryDate: z.string().min(1, 'Delivery date is required'),
      orderNumber: z.string().optional().default(''),
      testedBy: z.string().min(1, 'Tested by is required'),
      orderDate: z.string().min(1, 'Order date is required'),
    }),
    frame: z.object({
      selectionId: z.string().optional().default(''),
      barcode: z.string().optional().default(''),
      model: z.string().optional().default(''),
      color: z.string().optional().default(''),
      size: z.string().optional().default(''),
      frameId: z.string().optional().default(''),
      total: requiredMoney.default(0),
    }),
    lens: z.object({
      selectionId: z.string().optional().default(''),
      lensType: z.string().optional().default(''),
      color: z.string().optional().default(''),
      size: z.string().optional().default(''),
      lensId: z.string().optional().default(''),
      total: requiredMoney.default(0),
    }),
    expenses: z.array(expenseRowSchema).default([]),
    totals: z.object({
      discount: requiredMoney.default(0),
      advancedPayment: requiredMoney.default(0),
      fullPaymentDate: z.string().optional().default(''),
      invoiceNumber: z.string().optional().default(''),
    }),
    remarks: z.string().optional().default(''),
  })
  .superRefine((value, ctx) => {
    if (!value.patient.existingId && !value.patient.newData.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gender is required for new patients',
        path: ['patient', 'newData', 'gender'],
      })
    }
    if (!value.salesOrder.isOld) {
      if (!value.frame.selectionId && !value.frame.model.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frame selection is required', path: ['frame', 'selectionId'] })
      }
      if (!value.lens.selectionId && !value.lens.lensType.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Lens selection is required', path: ['lens', 'selectionId'] })
      }
    }
  })

type SalesOrderIntakeValues = z.infer<typeof salesOrderIntakeSchema>

interface LookupOption {
  label: string
  subtitle: string
  value: string
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Patient',      icon: RiUserLine },
  { id: 1, label: 'Prescription', icon: RiEyeLine },
  { id: 2, label: 'Order Info',   icon: RiFileTextLine },
  { id: 3, label: 'Frame',        icon: RiBox3Line },
  { id: 4, label: 'Lens',         icon: RiSparklingLine },
  { id: 5, label: 'Expenses',     icon: RiReceiptLine },
  { id: 6, label: 'Review',       icon: RiShieldCheckLine },
] as const

// ─── Small UI helpers ─────────────────────────────────────────────────────────

const Field = ({
  label,
  required,
  error,
  className,
  children,
}: {
  label?: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) => (
  <div className={`space-y-1.5 ${className ?? ''}`}>
    {label && (
      <label className="text-sm font-medium leading-none text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5"> *</span>}
      </label>
    )}
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

const InlineAlert = ({
  type,
  title,
  description,
}: {
  type: 'info' | 'warning' | 'success'
  title: string
  description?: string
}) => {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200',
  }
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${styles[type]}`}>
      <RiAlertLine className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
      </div>
    </div>
  )
}

const SummaryRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums">{formatCurrency(roundCurrency(value))}</span>
  </div>
)

const StepIndicator = ({ currentStep }: { currentStep: number }) => (
  <div className="flex items-center">
    {STEPS.map((step, index) => {
      const isPast = step.id < currentStep
      const isCurrent = step.id === currentStep
      return (
        <div key={step.id} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20'
                  : isPast
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground',
              ].join(' ')}
            >
              {isPast ? (
                <RiCheckLine className="h-4 w-4" />
              ) : (
                <span className="text-xs font-bold">{step.id + 1}</span>
              )}
            </div>
            <span
              className={[
                'hidden sm:block text-xs font-medium whitespace-nowrap',
                isCurrent ? 'text-primary' : isPast ? 'text-foreground' : 'text-muted-foreground',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`h-0.5 w-full mx-2 mb-4 transition-all duration-300 ${step.id < currentStep ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      )
    })}
  </div>
)

// ─── Static defaults ──────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0]

const defaultValues: SalesOrderIntakeValues = {
  patient: { existingId: '', newData: { fullName: '', phone: '', age: undefined, gender: undefined, address: '' } },
  prescription: {
    existingId: '',
    newData: {
      prescriptionDate: today, validUntil: today, diagnosis: '', notes: '',
      rightEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
      leftEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
    },
  },
  salesOrder: { isOld: false, deliveryDate: today, orderNumber: '', testedBy: '', orderDate: today },
  frame: { selectionId: '', barcode: '', model: '', color: '', size: '', frameId: '', total: 0 },
  lens: { selectionId: '', lensType: '', color: '', size: '', lensId: '', total: 0 },
  expenses: [],
  totals: { discount: 0, advancedPayment: 0, fullPaymentDate: '', invoiceNumber: '' },
  remarks: '',
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const normalizeText = (value: string) => value.trim().toLowerCase()

const formatAddress = (p: Patient) => {
  const a = p.address
  if (!a) return ''
  return [a.street, a.city, a.state, a.zip_code, a.country].filter(Boolean).join(', ')
}

const mapPrescriptionToForm = (rx: Prescription) => ({
  prescriptionDate: rx.prescription_date ? String(rx.prescription_date).split('T')[0] : today,
  validUntil: rx.valid_until ? String(rx.valid_until).split('T')[0] : today,
  diagnosis: rx.diagnosis || '',
  notes: rx.notes || '',
  rightEye: {
    sphere: rx.eye_prescription?.right_eye.sphere ?? 0,
    cylinder: rx.eye_prescription?.right_eye.cylinder ?? 0,
    axis: rx.eye_prescription?.right_eye.axis ?? 0,
    add: rx.eye_prescription?.right_eye.add ?? 0,
    pd: rx.eye_prescription?.right_eye.pupillary_distance ?? 0,
  },
  leftEye: {
    sphere: rx.eye_prescription?.left_eye.sphere ?? 0,
    cylinder: rx.eye_prescription?.left_eye.cylinder ?? 0,
    axis: rx.eye_prescription?.left_eye.axis ?? 0,
    add: rx.eye_prescription?.left_eye.add ?? 0,
    pd: rx.eye_prescription?.left_eye.pupillary_distance ?? 0,
  },
})

const buildPatientPayload = (values: SalesOrderIntakeValues['patient']) => ({
  name: values.newData.fullName,
  date_of_birth: values.newData.age
    ? new Date(new Date().setFullYear(new Date().getFullYear() - values.newData.age)).toISOString().split('T')[0]
    : today,
  gender: values.newData.gender || Gender.OTHER,
  phone: values.newData.phone,
  address: values.newData.address ? { street: values.newData.address } : undefined,
})

const buildPrescriptionPayload = (patientId: string, values: SalesOrderIntakeValues['prescription']) => ({
  patient_id: patientId,
  doctor_id: 'UNKNOWN',
  prescription_date: values.newData.prescriptionDate || today,
  valid_until: values.newData.validUntil || today,
  diagnosis: values.newData.diagnosis || 'Walk-in intake',
  notes: values.newData.notes || undefined,
  eye_prescription: {
    right_eye: {
      sphere: values.newData.rightEye.sphere,
      cylinder: values.newData.rightEye.cylinder,
      axis: values.newData.rightEye.axis,
      add: values.newData.rightEye.add,
      pupillary_distance: values.newData.rightEye.pd,
    },
    left_eye: {
      sphere: values.newData.leftEye.sphere,
      cylinder: values.newData.leftEye.cylinder,
      axis: values.newData.leftEye.axis,
      add: values.newData.leftEye.add,
      pupillary_distance: values.newData.leftEye.pd,
    },
    prescription_type: 'single-vision' as const,
  },
})

const mapProductToFrame = (product: Product) => ({
  selectionId: product.product_id,
  barcode: product.barcode || product.sku,
  model: product.name,
  color: product.specifications?.color ? String(product.specifications.color) : product.brand || '',
  size: product.specifications?.size ? String(product.specifications.size) : product.unit_of_measure || '',
  frameId: product.sku,
  total: product.selling_price,
})

// ─── Main component ───────────────────────────────────────────────────────────

const SalesOrderIntakeForm = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [savedOrderNumber, setSavedOrderNumber] = useState('')
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)

  // Data fetching
  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['sales-order-products-master'],
    queryFn: async () => {
      const firstPage = await productsApi.getAll({ page: 1, page_size: 100 })
      if (firstPage.total_pages <= 1) return firstPage
      const allItems = [...firstPage.data]
      for (let page = 2; page <= firstPage.total_pages; page += 1) {
        const nextPage = await productsApi.getAll({ page, page_size: 100 })
        allItems.push(...nextPage.data)
      }
      return { ...firstPage, data: allItems, page: 1, page_size: allItems.length }
    },
  })

  const { data: lensMasterData } = useLensMaster({ page: 1, page_size: 100, is_active: true })
  const { data: expenseMasterData } = useOtherExpenses({ page: 1, page_size: 100, is_active: true })

  // Form
  const { register, control, handleSubmit, setValue, getValues, reset, clearErrors, trigger, formState: { errors } } =
    useForm<SalesOrderIntakeValues>({ resolver: zodResolver(salesOrderIntakeSchema), defaultValues, mode: 'onSubmit' })

  const expenses = useWatch({ control, name: 'expenses' })
  const frame = useWatch({ control, name: 'frame' })
  const lens = useWatch({ control, name: 'lens' })
  const patient = useWatch({ control, name: 'patient' })
  const prescription = useWatch({ control, name: 'prescription' })
  const salesOrder = useWatch({ control, name: 'salesOrder' })
  const totals = useWatch({ control, name: 'totals' })

  const { data: matchingPatients } = usePatientSearch(`${patient.newData.phone || ''} ${patient.newData.fullName || ''}`)
  const { data: patientPrescriptions } = usePrescriptionFetch(patient.existingId || undefined)
  const { isScannerOpen: barcodeScannerOpen, openScanner, closeScanner, scanBarcode, isScanningProduct } = useBarcodeScanner()
  const { fields: expenseFields, append, remove } = useFieldArray({ control, name: 'expenses' })

  // Derived options
  const frameOptions = useMemo<LookupOption[]>(() => {
    const cats = new Set<ProductCategory>([ProductCategory.FRAMES, ProductCategory.SUNGLASSES])
    return (productData?.data || [])
      .filter((p) => cats.has(p.category) && p.current_stock > 0)
      .map((p) => ({ value: p.product_id, label: p.name, subtitle: `${p.sku}${p.barcode ? ` • ${p.barcode}` : ''} • ${formatCurrency(p.selling_price)}` }))
  }, [productData])

  const lensOptions = useMemo<LookupOption[]>(() =>
    (lensMasterData?.data || []).map((l) => ({ value: l.id, label: l.lens_type, subtitle: `${l.color} • ${l.size} • ${l.lens_code} • ${formatCurrency(l.price)}` }))
  , [lensMasterData])

  const expenseOptions = useMemo<LookupOption[]>(() =>
    (expenseMasterData?.data || []).map((e) => ({ value: e.id, label: e.name, subtitle: formatCurrency(e.default_cost) }))
  , [expenseMasterData])

  const matchedPatient = useMemo(() => {
    const results = (matchingPatients?.data || []).filter(Boolean)
    const phone = phoneDigits(patient.newData.phone || '')
    if (!phone && !patient.newData.fullName.trim()) return results[0] || null
    return (
      results.find((item) => phoneDigits(safeText(item?.phone)) === phone) ||
      results.find((item) => normalizeText(safeText(item?.name)).includes(normalizeText(patient.newData.fullName))) ||
      results[0] || null
    )
  }, [matchingPatients, patient.newData.fullName, patient.newData.phone])

  const patientIsLinked = !!patient.existingId
  const prescriptionIsLinked = !!prescription.existingId
  const isFullOrder = !!frame.selectionId && !!lens.selectionId

  const resolvedFrame = useMemo(() => {
    const selected = productData?.data?.find((item) => item.product_id === frame.selectionId)
    if (selected) return selected
    const manualValue = normalizeText(frame.model || frame.frameId || frame.barcode)
    if (!manualValue) return null
    return productData?.data?.find((item) =>
      [item.name, item.sku, item.barcode, item.product_id].filter(Boolean).some((c) => normalizeText(String(c)).includes(manualValue))
    ) || null
  }, [frame.barcode, frame.frameId, frame.model, frame.selectionId, productData])

  const resolvedLens = useMemo(
    () => lensMasterData?.data?.find((item) => item.id === lens.selectionId) || null,
    [lens.selectionId, lensMasterData]
  )

  const derivedTotals = useMemo(() =>
    calculateOrderTotals({
      frameTotal: frame.total || 0,
      lensTotal: lens.total || 0,
      expenses: (expenses || []).map((item) => ({ qty: Number(item.qty || 0), unitCost: Number(item.unitCost || 0), discount: Number(item.discount || 0) })),
      discount: Number(totals.discount || 0),
      advancedPayment: Number(totals.advancedPayment || 0),
      isOldOrder: salesOrder.isOld,
    })
  , [expenses, frame.total, lens.total, salesOrder.isOld, totals.advancedPayment, totals.discount])

  // Effects
  useEffect(() => {
    setValue('totals.advancedPayment', derivedTotals.advancedPayment, { shouldDirty: false, shouldValidate: false })
    setValue('totals.fullPaymentDate', derivedTotals.fullPaymentDate, { shouldDirty: false, shouldValidate: false })
    if (salesOrder.isOld) setValue('totals.invoiceNumber', '', { shouldDirty: false, shouldValidate: false })
  }, [derivedTotals.advancedPayment, derivedTotals.fullPaymentDate, salesOrder.isOld, setValue])

  useEffect(() => {
    if (!salesOrder.isOld) return
    if (!getValues('totals.fullPaymentDate')) setValue('totals.fullPaymentDate', today, { shouldDirty: false, shouldValidate: false })
  }, [getValues, salesOrder.isOld, setValue])

  useEffect(() => {
    if (prescription.existingId || prescription.newData.diagnosis || prescription.newData.notes) clearErrors('prescription')
  }, [clearErrors, prescription.existingId, prescription.newData.diagnosis, prescription.newData.notes])

  useEffect(() => {
    if (frame.selectionId && resolvedFrame) {
      setValue('frame.model', resolvedFrame.name, { shouldDirty: false, shouldValidate: false })
      setValue('frame.color', resolvedFrame.specifications?.color ? String(resolvedFrame.specifications.color) : resolvedFrame.brand || '', { shouldDirty: false, shouldValidate: false })
      setValue('frame.size', resolvedFrame.specifications?.size ? String(resolvedFrame.specifications.size) : resolvedFrame.unit_of_measure || '', { shouldDirty: false, shouldValidate: false })
      setValue('frame.frameId', resolvedFrame.sku, { shouldDirty: false, shouldValidate: false })
      setValue('frame.barcode', resolvedFrame.barcode || resolvedFrame.sku, { shouldDirty: false, shouldValidate: false })
      setValue('frame.total', resolvedFrame.selling_price, { shouldDirty: false, shouldValidate: false })
    }
  }, [frame.selectionId, resolvedFrame, setValue])

  useEffect(() => {
    if (lens.selectionId && resolvedLens) {
      setValue('lens.lensType', resolvedLens.lens_type, { shouldDirty: false, shouldValidate: false })
      setValue('lens.color', resolvedLens.color, { shouldDirty: false, shouldValidate: false })
      setValue('lens.size', resolvedLens.size, { shouldDirty: false, shouldValidate: false })
      setValue('lens.lensId', resolvedLens.lens_code, { shouldDirty: false, shouldValidate: false })
      setValue('lens.total', resolvedLens.price, { shouldDirty: false, shouldValidate: false })
    }
  }, [lens.selectionId, resolvedLens, setValue])

  useEffect(() => {
    const next = (expenses || []).map((row) => ({
      ...row,
      total: calculateLineTotal({ qty: Number(row.qty || 0), unitCost: Number(row.unitCost || 0), discount: Number(row.discount || 0) }),
    }))
    if (next.some((row, i) => row.total !== expenses[i]?.total)) {
      setValue('expenses', next, { shouldDirty: true, shouldValidate: false })
    }
  }, [expenses, setValue])

  // Mutations
  const createPatientMutation = useMutation({ mutationFn: (p: Parameters<typeof patientsApi.create>[0]) => patientsApi.create(p) })
  const createPrescriptionMutation = useMutation({ mutationFn: (p: Parameters<typeof prescriptionsApi.create>[0]) => prescriptionsApi.create(p) })
  const createSalesOrderMutation = useMutation({ mutationFn: (p: Parameters<typeof salesOrdersApi.create>[0]) => salesOrdersApi.create(p) })
  const generateInvoiceMutation = useMutation({ mutationFn: (orderId: string) => salesOrdersApi.generateInvoice(orderId) })

  // Handlers
  const applyFrameSelection = (product: Product) => setValue('frame', mapProductToFrame(product), { shouldDirty: true, shouldValidate: true })

  const applyLensSelection = (lensType: NonNullable<typeof lensMasterData>['data'][number]) => {
    setValue('lens.selectionId', lensType.id, { shouldDirty: true, shouldValidate: true })
    setValue('lens.lensType', lensType.lens_type, { shouldDirty: true, shouldValidate: true })
    setValue('lens.color', lensType.color, { shouldDirty: true, shouldValidate: true })
    setValue('lens.size', lensType.size, { shouldDirty: true, shouldValidate: true })
    setValue('lens.lensId', lensType.lens_code, { shouldDirty: true, shouldValidate: true })
    setValue('lens.total', lensType.price, { shouldDirty: true, shouldValidate: true })
  }

  const handlePatientAction = (rec: Patient) => {
    setValue('patient.existingId', rec.patient_id, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.fullName', rec.name, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.phone', rec.phone, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.age', rec.age, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.gender', rec.gender, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.address', formatAddress(rec), { shouldDirty: true, shouldValidate: true })
    toast.success(`Linked to ${rec.name}`)
  }

  const continueAsNew = () => {
    const phone = phoneDigits(patient.newData.phone || '')
    const matchedPhone = phoneDigits(safeText(matchedPatient?.phone))
    if (matchedPhone && phone === matchedPhone) { toast.error('Phone number already exists.'); return }
    setValue('patient.existingId', '', { shouldDirty: true, shouldValidate: true })
    toast.success('Continuing as a new patient')
  }

  const addExpenseRow = () => append({ expenseTypeId: '', expenseTypeName: '', qty: 1, unitCost: 0, discount: 0, total: 0 })

  const updateExpenseRow = (index: number, field: keyof SalesOrderIntakeValues['expenses'][number], value: string | number) => {
    const current = getValues('expenses')
    const next = [...current]
    const row = { ...next[index] }
    ;(row as any)[field] = value
    if (field === 'expenseTypeId') {
      const exp = expenseMasterData?.data.find((item) => item.id === value)
      if (exp) { row.expenseTypeName = exp.name; if (!row.unitCost) row.unitCost = exp.default_cost }
      else if (!value) row.expenseTypeName = ''
    }
    row.total = calculateLineTotal({ qty: Number(row.qty || 0), unitCost: Number(row.unitCost || 0), discount: Number(row.discount || 0) })
    next[index] = row
    setValue('expenses', next, { shouldDirty: true, shouldValidate: true })
  }

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const product = await scanBarcode(barcode)
      if (!product) { toast.error('Frame not found for this barcode'); return }
      applyFrameSelection(product)
      toast.success(`Frame loaded: ${product.name}`)
      closeScanner()
    } catch {
      toast.error('Frame not found for this barcode')
    }
  }

  const handleNext = async () => {
    let fields: string[] = []
    if (currentStep === 0) fields = ['patient.newData.fullName', 'patient.newData.phone']
    else if (currentStep === 2) fields = ['salesOrder.orderDate', 'salesOrder.deliveryDate', 'salesOrder.testedBy']
    if (fields.length > 0) {
      const valid = await trigger(fields as any)
      if (!valid) return
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0))

  const handleReset = () => { reset(defaultValues); setSavedOrderNumber(''); setSavedInvoice(null); setCurrentStep(0) }

  const onSubmit = async (values: SalesOrderIntakeValues) => {
    try {
      const phone = phoneDigits(values.patient.newData.phone)
      const exactDuplicate = phone ? (matchingPatients?.data || []).find((item) => phoneDigits(safeText(item?.phone)) === phone) : null
      if (!values.patient.existingId && exactDuplicate) { toast.error('Phone number already exists.'); return }

      const patientId = values.patient.existingId || (await createPatientMutation.mutateAsync(buildPatientPayload(values.patient))).patient_id

      const shouldCreateRx = !values.prescription.existingId && Boolean(
        values.prescription.newData.diagnosis.trim() || values.prescription.newData.notes.trim() ||
        values.prescription.newData.rightEye.sphere !== 0 || values.prescription.newData.rightEye.cylinder !== 0 ||
        values.prescription.newData.leftEye.sphere !== 0 || values.prescription.newData.leftEye.cylinder !== 0
      )
      let prescriptionId = values.prescription.existingId || ''
      if (shouldCreateRx) {
        const createdRx = await createPrescriptionMutation.mutateAsync(buildPrescriptionPayload(patientId, values.prescription))
        prescriptionId = createdRx.prescription_id
      }

      const frameItem = values.frame.selectionId ? resolvedFrame : null
      if (!frameItem) { toast.error('Frame selection is required'); return }
      const lensItem = resolvedLens
      if (!values.salesOrder.isOld && !lensItem) { toast.error('Lens selection is required'); return }
      if (!values.salesOrder.isOld) {
        const invalidExpense = (values.expenses || []).some((e) => !e.expenseTypeId || !expenseMasterData?.data.some((item) => item.id === e.expenseTypeId))
        if (invalidExpense) { toast.error('Expense type must come from master data'); return }
      }

      const itemPayload: SalesOrderItem[] = [
        { product_id: frameItem.product_id, product_name: values.frame.model || frameItem.name, sku: values.frame.frameId || frameItem.sku, quantity: 1, unit_price: Number(values.frame.total || frameItem.selling_price), total: Number(values.frame.total || frameItem.selling_price), master_data_id: frameItem.product_id, line_type: 'product' as const, track_stock: true },
      ]
      if (lensItem || values.salesOrder.isOld) {
        itemPayload.push({ product_id: lensItem?.id || values.lens.lensId || 'LENS', product_name: values.lens.lensType || lensItem?.lens_type || 'Lens', sku: values.lens.lensId || lensItem?.lens_code || 'LENS', quantity: 1, unit_price: Number(values.lens.total || lensItem?.price || 0), total: Number(values.lens.total || lensItem?.price || 0), master_data_id: lensItem?.id, line_type: 'lens' as const, track_stock: false })
      }
      itemPayload.push(...values.expenses.map((expense) => {
        const sel = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
        return { product_id: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE', product_name: expense.expenseTypeName || sel?.name || 'Expense', sku: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE', quantity: Number(expense.qty || 0), unit_price: Number(expense.unitCost || 0), total: calculateLineTotal({ qty: Number(expense.qty || 0), unitCost: Number(expense.unitCost || 0), discount: Number(expense.discount || 0) }), master_data_id: sel?.id || expense.expenseTypeId || undefined, line_type: 'expense' as const, track_stock: false }
      }))

      const orderPayload = {
        patient_id: patientId,
        prescription_id: prescriptionId || undefined,
        tested_by: values.salesOrder.testedBy,
        expected_delivery_date: values.salesOrder.deliveryDate,
        notes: [values.remarks.trim(), values.salesOrder.isOld ? `Legacy SO Number: ${values.salesOrder.orderNumber || 'manual entry'}` : ''].filter(Boolean).join('\n'),
        measurements: { order_date: values.salesOrder.orderDate, order_type: isFullOrder ? 'FULL_ORDER' : 'PARTIAL_ORDER', frame_total: values.frame.total, lens_total: values.lens.total, other_expenses_total: derivedTotals.expenseTotal, discount: values.totals.discount, advance_payment: values.totals.advancedPayment },
        status: 'confirmed' as const,
        items: itemPayload,
      }

      const createdOrder = await createSalesOrderMutation.mutateAsync(orderPayload)
      setSavedOrderNumber(createdOrder.order_number)
      setValue('salesOrder.orderNumber', createdOrder.order_number, { shouldDirty: false, shouldValidate: false })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', patientId] })

      if (!values.salesOrder.isOld) {
        const invoice = await generateInvoiceMutation.mutateAsync(createdOrder.order_id)
        setSavedInvoice(invoice)
        setValue('totals.invoiceNumber', invoice.invoice_number, { shouldDirty: false, shouldValidate: false })
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        toast.success(`Invoice ${invoice.invoice_number} generated`)
      } else {
        setSavedInvoice(null)
        toast.success(`Historical SO saved as ${createdOrder.order_number}`)
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to save sales order')
    }
  }

  if (isLoadingProducts) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-border bg-card">
        <Loading text="Loading sales order masters..." />
      </div>
    )
  }

  const isSaving = createPatientMutation.isPending || createPrescriptionMutation.isPending || createSalesOrderMutation.isPending || generateInvoiceMutation.isPending

  return (
    <>
      <QRScanner isOpen={barcodeScannerOpen} onScan={handleBarcodeScan} onClose={closeScanner} />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Progress stepper */}
        <Card className="px-6 py-5">
          <StepIndicator currentStep={currentStep} />
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Step 0: Patient ─────────────────────────────────────────────── */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiUserLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Patient Information</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Search for an existing patient or register a new one</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Full Name" required error={errors.patient?.newData?.fullName?.message}>
                    <Input placeholder="John Doe" {...register('patient.newData.fullName')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Phone Number" required error={errors.patient?.newData?.phone?.message}>
                    <Input placeholder="0771234567" {...register('patient.newData.phone')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Age" error={errors.patient?.newData?.age?.message as string | undefined}>
                    <Input type="number" min={0} placeholder="34" {...register('patient.newData.age')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Gender" required={!patientIsLinked} error={errors.patient?.newData?.gender?.message}>
                    <Select
                      value={patient.newData.gender || ''}
                      onValueChange={(val) => setValue('patient.newData.gender', val as Gender, { shouldDirty: true, shouldValidate: true })}
                      disabled={patientIsLinked}
                    >
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Gender.MALE}>Male</SelectItem>
                        <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                        <SelectItem value={Gender.OTHER}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Address">
                  <Input placeholder="Street address or delivery note" {...register('patient.newData.address')} disabled={patientIsLinked} />
                </Field>

                {matchedPatient && !patientIsLinked && (
                  <div className="space-y-3">
                    <InlineAlert type="warning" title="Existing patient found" description={`${safeText(matchedPatient.name)} — ${safeText(matchedPatient.phone)}`} />
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" onClick={() => handlePatientAction(matchedPatient)}>Use Existing Patient</Button>
                      <Button type="button" variant="outline" onClick={continueAsNew}>Continue as New</Button>
                    </div>
                  </div>
                )}

                {patientIsLinked && (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RiCheckLine className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Patient linked: {patient.newData.fullName}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={continueAsNew}>Unlink</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 1: Prescription ────────────────────────────────────────── */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiEyeLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Prescription & Eye Measurements</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Link an existing prescription or enter new measurements</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-6">
                {patient.existingId && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Field label="Load Existing Prescription" className="flex-1">
                      <Select
                        value={prescription.existingId || ''}
                        onValueChange={(selectedId) => {
                          setValue('prescription.existingId', selectedId, { shouldDirty: true, shouldValidate: true })
                          const rx = (patientPrescriptions?.data || []).find((item) => item.prescription_id === selectedId)
                          if (rx) setValue('prescription.newData', mapPrescriptionToForm(rx), { shouldDirty: true, shouldValidate: false })
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select a prescription" /></SelectTrigger>
                        <SelectContent>
                          {(patientPrescriptions?.data || []).map((item) => (
                            <SelectItem key={item.prescription_id} value={item.prescription_id}>
                              {item.prescription_date ? String(item.prescription_date).split('T')[0] : item.prescription_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button type="button" variant="outline" onClick={() => { setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: true }); setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false }) }}>
                      + New Prescription
                    </Button>
                  </div>
                )}

                {prescriptionIsLinked && (
                  <InlineAlert type="info" title="Prescription loaded" description="Fields are read-only. Click '+ New Prescription' to enter custom values." />
                )}

                <Tabs defaultValue="right">
                  <TabsList className="w-full">
                    <TabsTrigger value="right" className="flex-1">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">OD</span>
                      Right Eye
                    </TabsTrigger>
                    <TabsTrigger value="left" className="flex-1">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">OS</span>
                      Left Eye
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="right" className="mt-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                      <Field label="Sphere"><Input type="number" step="0.25" {...register('prescription.newData.rightEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Cylinder"><Input type="number" step="0.25" {...register('prescription.newData.rightEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Axis"><Input type="number" step="1" {...register('prescription.newData.rightEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Add"><Input type="number" step="0.25" {...register('prescription.newData.rightEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="PD"><Input type="number" step="0.1" {...register('prescription.newData.rightEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                    </div>
                  </TabsContent>

                  <TabsContent value="left" className="mt-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                      <Field label="Sphere"><Input type="number" step="0.25" {...register('prescription.newData.leftEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Cylinder"><Input type="number" step="0.25" {...register('prescription.newData.leftEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Axis"><Input type="number" step="1" {...register('prescription.newData.leftEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="Add"><Input type="number" step="0.25" {...register('prescription.newData.leftEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                      <Field label="PD"><Input type="number" step="0.1" {...register('prescription.newData.leftEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} /></Field>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Diagnosis">
                    <Input {...register('prescription.newData.diagnosis')} disabled={prescriptionIsLinked} placeholder="e.g. Myopia" />
                  </Field>
                  <Field label="Notes">
                    <Input {...register('prescription.newData.notes')} disabled={prescriptionIsLinked} placeholder="Any clinical notes" />
                  </Field>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Order Info ──────────────────────────────────────────── */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiFileTextLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Order Details</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Dates, tested by, and order type</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Order Date" required error={errors.salesOrder?.orderDate?.message}>
                    <Input type="date" {...register('salesOrder.orderDate')} />
                  </Field>
                  <Field label="Delivery Date" required error={errors.salesOrder?.deliveryDate?.message}>
                    <Input type="date" {...register('salesOrder.deliveryDate')} />
                  </Field>
                  <Field label="Tested By" required error={errors.salesOrder?.testedBy?.message}>
                    <Input placeholder="Optometrist name" {...register('salesOrder.testedBy')} />
                  </Field>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Order Type</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${!salesOrder.isOld ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" className="mt-1" checked={!salesOrder.isOld} onChange={() => setValue('salesOrder.isOld', false, { shouldDirty: true, shouldValidate: true })} />
                      <div>
                        <p className="font-semibold text-foreground">New Sales Order</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Auto-generates SO# and invoice</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${salesOrder.isOld ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : 'border-border hover:bg-muted/50'}`}>
                      <input type="radio" className="mt-1" checked={salesOrder.isOld} onChange={() => setValue('salesOrder.isOld', true, { shouldDirty: true, shouldValidate: true })} />
                      <div>
                        <p className="font-semibold text-foreground">Historical Entry</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Legacy paper order, no invoice</p>
                      </div>
                    </label>
                  </div>
                </div>

                {salesOrder.isOld && (
                  <Field label="Legacy SO Number">
                    <Input placeholder="Original order number" {...register('salesOrder.orderNumber')} />
                  </Field>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Frame ───────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiBox3Line className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Frame Selection</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Scan a barcode or search from inventory</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                <Button type="button" variant="outline" onClick={openScanner} disabled={isScanningProduct} className="w-full h-12 text-base gap-2">
                  <RiScanLine className="h-5 w-5" />
                  {isScanningProduct ? 'Scanning...' : 'Scan Barcode'}
                </Button>

                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">or search</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Field label="Frame" error={errors.frame?.selectionId?.message}>
                  <SearchableLOV
                    placeholder="Search by name, SKU, or barcode"
                    value={frame.selectionId || ''}
                    onChange={(value) => {
                      const product = productData?.data.find((item) => String(item.product_id) === String(value))
                      if (product) { applyFrameSelection(product); return }
                      setValue('frame.selectionId', value, { shouldDirty: true, shouldValidate: true })
                    }}
                    options={frameOptions}
                  />
                </Field>

                <div className={`rounded-xl border p-4 ${frame.selectionId ? 'border-border bg-muted/30' : 'border-dashed border-border'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    {frame.selectionId ? 'Auto-filled Details' : 'Manual Entry'}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Model"><Input {...register('frame.model')} placeholder="Frame model" /></Field>
                    <Field label="Color"><Input {...register('frame.color')} placeholder="Color" /></Field>
                    <Field label="Size"><Input {...register('frame.size')} placeholder="Size" /></Field>
                    <Field label="Barcode / SKU"><Input {...register('frame.barcode')} placeholder="Barcode or SKU" /></Field>
                    <Field label="Price"><Input type="number" step="0.01" placeholder="0.00" {...register('frame.total', { valueAsNumber: true })} /></Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Lens ────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiSparklingLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Lens Selection</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Select from the lens master catalog</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                <Field label="Lens" error={errors.lens?.selectionId?.message}>
                  <SearchableLOV
                    placeholder="Search lens type, color, size..."
                    value={lens.selectionId || ''}
                    onChange={(value) => {
                      const lensType = lensMasterData?.data.find((item) => String(item.id) === String(value))
                      if (lensType) { applyLensSelection(lensType); return }
                      setValue('lens.selectionId', value, { shouldDirty: true, shouldValidate: true })
                    }}
                    options={lensOptions}
                  />
                </Field>

                <div className={`rounded-xl border p-4 ${lens.selectionId ? 'border-border bg-muted/30' : 'border-dashed border-border'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    {lens.selectionId ? 'Auto-filled Details' : 'Manual Entry'}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Lens Type"><Input {...register('lens.lensType')} placeholder="e.g. Single Vision" /></Field>
                    <Field label="Color"><Input {...register('lens.color')} placeholder="Color" /></Field>
                    <Field label="Size"><Input {...register('lens.size')} placeholder="Size" /></Field>
                    <Field label="Code"><Input {...register('lens.lensId')} placeholder="Lens code" /></Field>
                    <Field label="Price"><Input type="number" step="0.01" placeholder="0.00" {...register('lens.total', { valueAsNumber: true })} /></Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 5: Expenses ────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <RiReceiptLine className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Other Expenses</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">Additional charges and services</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addExpenseRow}>
                      <RiAddLine className="mr-1.5 h-4 w-4" />
                      Add Expense
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  {expenseFields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                      <RiReceiptLine className="mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No expenses added yet</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">Click "Add Expense" to include additional charges</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expense Type</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground w-20">Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">Unit Cost</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">Discount</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28">Total</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {expenseFields.map((field, index) => (
                            <tr key={field.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3">
                                <SearchableLOV placeholder="Select expense" value={expenses?.[index]?.expenseTypeId || ''} onChange={(value) => updateExpenseRow(index, 'expenseTypeId', value)} options={expenseOptions} />
                              </td>
                              <td className="px-4 py-3">
                                <Input type="number" min={0} step="1" className="w-16 text-center" value={expenses?.[index]?.qty || 0} onChange={(e) => updateExpenseRow(index, 'qty', Number(e.target.value))} />
                              </td>
                              <td className="px-4 py-3">
                                <Input type="number" min={0} step="0.01" className="text-right" value={expenses?.[index]?.unitCost || 0} onChange={(e) => updateExpenseRow(index, 'unitCost', Number(e.target.value))} />
                              </td>
                              <td className="px-4 py-3">
                                <Input type="number" min={0} step="0.01" className="text-right" value={expenses?.[index]?.discount || 0} onChange={(e) => updateExpenseRow(index, 'discount', Number(e.target.value))} />
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(expenses?.[index]?.total || 0)}</td>
                              <td className="px-4 py-3 text-center">
                                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(index)}>
                                  <RiDeleteBin6Line className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Remarks & Notes</CardTitle></CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <Textarea {...register('remarks')} rows={4} placeholder="Add any special instructions or notes about this order..." className="resize-none" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Step 6: Review & Payment ────────────────────────────────────── */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <RiShieldCheckLine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Order Summary</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {patient.newData.fullName && `${patient.newData.fullName} · `}
                        {isFullOrder ? 'Full Order' : 'Partial Order'}
                        {salesOrder.isOld ? ' · Historical' : ' · Invoice Eligible'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <div className="divide-y divide-border">
                    <SummaryRow label="Frame" value={derivedTotals.frameTotal} />
                    <SummaryRow label="Lens" value={derivedTotals.lensTotal} />
                    <SummaryRow label="Other Expenses" value={derivedTotals.expenseTotal} />
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold">Subtotal</span>
                    <span className="text-2xl font-bold tabular-nums">{formatCurrency(roundCurrency(derivedTotals.subtotal))}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
                <Separator />
                <CardContent className="pt-6 space-y-5">
                  <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Due</p>
                    <p className="mt-1 text-4xl font-bold tabular-nums">{formatCurrency(roundCurrency(derivedTotals.subtotal))}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Advance / Partial Payment">
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={totals.advancedPayment || 0} onChange={(e) => setValue('totals.advancedPayment', Number(e.target.value), { shouldDirty: true })} disabled={salesOrder.isOld} />
                    </Field>
                    <Field label="Overall Discount">
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={totals.discount || 0} onChange={(e) => setValue('totals.discount', Number(e.target.value), { shouldDirty: true })} />
                    </Field>
                  </div>

                  <div className="rounded-xl border-2 border-primary bg-primary/5 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding Balance</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{formatCurrency(roundCurrency(derivedTotals.balancePayment))}</p>
                  </div>

                  {!salesOrder.isOld && (
                    <Field label="Date of Full Payment">
                      <Input type="date" value={totals.fullPaymentDate || ''} onChange={(e) => setValue('totals.fullPaymentDate', e.target.value, { shouldDirty: true })} />
                    </Field>
                  )}

                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RiTimeLine className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Invoice</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {totals.invoiceNumber || savedInvoice?.invoice_number
                        ? (totals.invoiceNumber || savedInvoice?.invoice_number)
                        : salesOrder.isOld ? 'None (historical)' : 'Generated after save'}
                    </span>
                  </div>

                  {(savedInvoice || totals.invoiceNumber) && !salesOrder.isOld && (
                    <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/invoices?detail=${savedInvoice?.invoice_id || totals.invoiceNumber}`)}>
                      <RiEyeLine className="mr-2 h-4 w-4" />
                      View Invoice
                    </Button>
                  )}

                  {salesOrder.isOld && (
                    <InlineAlert type="warning" title="Historical entry" description="No invoice will be generated for this order." />
                  )}
                </CardContent>
              </Card>

              {savedOrderNumber && (
                <InlineAlert type="success" title={`Order saved: ${savedOrderNumber}`} description={savedInvoice ? `Invoice ${savedInvoice.invoice_number} generated.` : undefined} />
              )}
            </div>
          )}

          {/* ── Navigation ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {currentStep > 0 && !savedOrderNumber && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <RiArrowLeftSLine className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {savedOrderNumber ? (
                <Button type="button" variant="outline" onClick={handleReset}>Create Another Order</Button>
              ) : currentStep < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  Next Step
                  <RiArrowRightSLine className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <><RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <>Create Sales Order<RiArrowRightSLine className="ml-1.5 h-4 w-4" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

export default SalesOrderIntakeForm
