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
  RiBriefcaseLine,
  RiGiftLine,
  RiSparklingLine as RiSparklingFill,
} from '@remixicon/react'
import { useNavigate } from 'react-router-dom'
import { RiSaveLine, RiFileEditLine } from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'
import SearchableLOV from '@/components/common/SearchableLOV'
import SaveRecordDialog from '@/components/common/SaveRecordDialog'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { productsApi } from '@/api/products.api'
import { frameVariantsApi } from '@/api/frames.api'
import { salesOrdersApi } from '@/api/erp.api'
import { usersApi } from '@/api/users.api'
import { useOtherExpenses } from '@/hooks/useOtherExpenses'
import { useLensMaster } from '@/hooks/useLensMaster'
import { basicDataApi } from '@/api/basic-data.api'
import { ComplimentaryProductSuggestion } from '@/types/basic-data.types'
import { Invoice } from '@/types/invoice.types'
import { Gender } from '@/types/common.types'
import { Patient } from '@/types/patient.types'
import { Prescription } from '@/types/prescription.types'
import { Product } from '@/types/product.types'
import { SalesOrder, SalesOrderItem } from '@/types/erp.types'
import { FrameVariant } from '@/types/frames.types'
import { VariantPicker } from '@/components/frames/VariantPicker'
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

// Sphere and cylinder can be negative (myopia/hyperopia values like -2.50, +1.25)
const signedNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}, z.number())

const eyeMeasurementSchema = z.object({
  sphere: signedNumber,
  cylinder: signedNumber,
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
        email: z.string().email('Invalid email address').optional().default(''),
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
      dateOfFullPayment: z.string().min(1, 'Date of full payment is required'),
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
      discountType: z.enum(['AMOUNT', 'PERCENT']).default('AMOUNT'),
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
      // Frame validation is handled in onSubmit (variant or catalog)
      if (!value.frame.selectionId && !value.frame.model.trim() && !value.frame.barcode.trim()) {
        // allow — variant picker sets selectionId; we validate in onSubmit
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
// Order: Patient → Prescription → Frame → Lens → Expenses → Order Info → Review

const STEPS = [
  { id: 0, label: 'Patient',      icon: RiUserLine },
  { id: 1, label: 'Prescription', icon: RiEyeLine },
  { id: 2, label: 'Frame',        icon: RiBox3Line },
  { id: 3, label: 'Lens',         icon: RiSparklingLine },
  { id: 4, label: 'Expenses',     icon: RiReceiptLine },
  { id: 5, label: 'Order Info',   icon: RiFileTextLine },
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

// Compact pricing panel shown from Frame step through Order Info step
const PricingPanel = ({ derivedTotals }: { derivedTotals: ReturnType<typeof calculateOrderTotals> }) => (
  <Card className="border-dashed bg-muted/20">
    <CardContent className="px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Live Pricing</p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frame</span>
          <span className="tabular-nums font-medium">{formatCurrency(roundCurrency(derivedTotals.frameTotal))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Lens</span>
          <span className="tabular-nums font-medium">{formatCurrency(roundCurrency(derivedTotals.lensTotal))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Expenses</span>
          <span className="tabular-nums font-medium">{formatCurrency(roundCurrency(derivedTotals.expenseTotal))}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Subtotal</span>
          <span className="text-base font-bold tabular-nums">{formatCurrency(roundCurrency(derivedTotals.subtotal))}</span>
        </div>
      </div>
    </CardContent>
  </Card>
)

const StepIndicator = ({
  currentStep,
  maxStepReached,
  onStepClick,
}: {
  currentStep: number
  maxStepReached: number
  onStepClick: (step: number) => void
}) => (
  <div className="flex items-center">
    {STEPS.map((step, index) => {
      const isPast = step.id < currentStep
      const isCurrent = step.id === currentStep
      const isReachable = step.id <= maxStepReached
      const isClickable = isReachable && !isCurrent
      return (
        <div key={step.id} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              onClick={() => isClickable && onStepClick(step.id)}
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200',
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20'
                  : isPast
                    ? 'border-primary bg-primary text-primary-foreground cursor-pointer hover:opacity-75'
                    : isClickable
                      ? 'border-primary bg-background text-primary cursor-pointer hover:bg-muted/50'
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
              onClick={() => isClickable && onStepClick(step.id)}
              className={[
                'hidden sm:block text-xs font-medium whitespace-nowrap',
                isCurrent
                  ? 'text-primary'
                  : isPast
                    ? 'text-foreground cursor-pointer hover:text-primary'
                    : isClickable
                      ? 'text-primary cursor-pointer hover:opacity-80'
                      : 'text-muted-foreground',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`h-0.5 w-full mx-2 mb-4 transition-all duration-300 ${step.id < maxStepReached ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      )
    })}
  </div>
)

// ─── Static defaults ──────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0]

const defaultValues: SalesOrderIntakeValues = {
  patient: { existingId: '', newData: { fullName: '', email: '', phone: '', age: undefined, gender: undefined, address: '' } },
  prescription: {
    existingId: '',
    newData: {
      prescriptionDate: today, validUntil: today, diagnosis: '', notes: '',
      rightEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
      leftEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
    },
  },
  salesOrder: { isOld: false, deliveryDate: today, dateOfFullPayment: today, orderNumber: '', testedBy: '', orderDate: today },
  frame: { selectionId: '', barcode: '', model: '', color: '', size: '', frameId: '', total: 0 },
  lens: { selectionId: '', lensType: '', color: '', size: '', lensId: '', total: 0 },
  expenses: [],
  totals: { discountType: 'AMOUNT', discount: 0, advancedPayment: 0, fullPaymentDate: '', invoiceNumber: '' },
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
    sphere: rx.eye_prescription?.right_eye?.sphere ?? 0,
    cylinder: rx.eye_prescription?.right_eye?.cylinder ?? 0,
    axis: rx.eye_prescription?.right_eye?.axis ?? 0,
    add: rx.eye_prescription?.right_eye?.add ?? 0,
    pd: rx.eye_prescription?.right_eye?.pupillary_distance ?? 0,
  },
  leftEye: {
    sphere: rx.eye_prescription?.left_eye?.sphere ?? 0,
    cylinder: rx.eye_prescription?.left_eye?.cylinder ?? 0,
    axis: rx.eye_prescription?.left_eye?.axis ?? 0,
    add: rx.eye_prescription?.left_eye?.add ?? 0,
    pd: rx.eye_prescription?.left_eye?.pupillary_distance ?? 0,
  },
})

const buildPatientPayload = (values: SalesOrderIntakeValues['patient']) => ({
  name: values.newData.fullName,
  date_of_birth: values.newData.age
    ? new Date(new Date().setFullYear(new Date().getFullYear() - values.newData.age)).toISOString().split('T')[0]
    : today,
  gender: values.newData.gender || Gender.OTHER,
  phone: values.newData.phone,
  email: values.newData.email || undefined,
  address: values.newData.address ? { street: values.newData.address } : undefined,
})

const buildPrescriptionPayload = (patientId: string, values: SalesOrderIntakeValues['prescription']) => ({
  patient_id: patientId,
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

// ─── Draft → form mapper ──────────────────────────────────────────────────────

const mapDraftToFormValues = (
  order: SalesOrder,
  patient: Patient | null,
  prescription: import('@/types/prescription.types').Prescription | null,
): SalesOrderIntakeValues => {
  const frameItem = order.items.find((i) => i.line_type === 'product')
  const lensItem  = order.items.find((i) => i.line_type === 'lens')
  const expItems  = order.items.filter((i) => i.line_type === 'expense')
  const meas = (order.measurements || {}) as Record<string, any>

  return {
    patient: {
      existingId: order.patient_id,
      newData: {
        fullName:  patient?.name    || '',
          email:     patient?.email   || '',
        phone:     patient?.phone   || '',
        age:       patient?.age,
        gender:    patient?.gender  as Gender | undefined,
        address:   patient ? formatAddress(patient) : '',
      },
    },
    prescription: {
      existingId: order.prescription_id || '',
      newData: prescription ? mapPrescriptionToForm(prescription) : defaultValues.prescription.newData,
    },
    frame: frameItem ? {
      selectionId: frameItem.product_id,
      barcode:     frameItem.sku || '',
      model:       frameItem.product_name || '',
      color:       '',
      size:        '',
      frameId:     frameItem.sku || '',
      total:       frameItem.unit_price,
    } : defaultValues.frame,
    lens: lensItem ? {
      selectionId: lensItem.master_data_id || lensItem.product_id,
      lensType:    lensItem.product_name || '',
      color:       '',
      size:        '',
      lensId:      lensItem.sku || '',
      total:       lensItem.unit_price,
    } : defaultValues.lens,
    expenses: expItems.map((e) => ({
      expenseTypeId:   e.master_data_id || e.product_id || '',
      expenseTypeName: e.product_name || '',
      qty:             e.quantity,
      unitCost:        e.unit_price,
      discount:        0,
      total:           e.total,
    })),
    salesOrder: {
      isOld:        false,
      deliveryDate: order.expected_delivery_date ? String(order.expected_delivery_date).split('T')[0] : today,
      dateOfFullPayment: order.date_of_full_payment ? String(order.date_of_full_payment).split('T')[0] : today,
      orderNumber:  order.order_number,
      testedBy:     order.tested_by || '',
      orderDate:    meas.order_date ? String(meas.order_date) : today,
    },
    totals: {
      discountType: 'AMOUNT',
      discount:        Number(meas.discount        || 0),
      advancedPayment: Number(meas.advance_payment || 0),
      fullPaymentDate: '',
      invoiceNumber:   '',
    },
    remarks: order.notes || '',
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

const SalesOrderIntakeForm = ({ draftOrderId }: { draftOrderId?: string }) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [maxStepReached, setMaxStepReached] = useState(0)
  const [savedOrderNumber, setSavedOrderNumber] = useState('')
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [freshMatchedPatient, setFreshMatchedPatient] = useState<Patient | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

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

  const [includeCase, setIncludeCase] = useState(true)
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [includeBag, setIncludeBag] = useState(true)
  const [selectedBagId, setSelectedBagId] = useState('')
  const [suggestedCase, setSuggestedCase] = useState<ComplimentaryProductSuggestion | null>(null)
  const [frameSource, setFrameSource] = useState<'catalog' | 'variant'>('variant')
  const [selectedFrameVariant, setSelectedFrameVariant] = useState<FrameVariant | null>(null)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  // Form
  const { register, control, handleSubmit, setValue, getValues, reset, clearErrors, trigger, formState: { errors, isDirty } } =
    useForm<SalesOrderIntakeValues>({ resolver: zodResolver(salesOrderIntakeSchema), defaultValues, mode: 'onSubmit' })

  const expenses = useWatch({ control, name: 'expenses' })
  const frame = useWatch({ control, name: 'frame' })
  const lens = useWatch({ control, name: 'lens' })
  const patient = useWatch({ control, name: 'patient' })
  const prescription = useWatch({ control, name: 'prescription' })
  const salesOrder = useWatch({ control, name: 'salesOrder' })
  const totals = useWatch({ control, name: 'totals' })

  useEffect(() => {
    setMaxStepReached((prev) => Math.max(prev, currentStep))
  }, [currentStep])

  const isFormDirty = isDirty && !savedOrderNumber
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null)

  // Intercept in-app navigation when form is dirty using history.listen
  useEffect(() => {
    if (!isFormDirty) return
    // history.pushState / replaceState monkey-patch to intercept SPA navigation
    const originalPush = window.history.pushState.bind(window.history)
    window.history.pushState = (state, title, url) => {
      if (url && url !== window.location.pathname + window.location.search) {
        setPendingNavPath(String(url))
        setShowLeaveDialog(true)
        return
      }
      originalPush(state, title, url)
    }
    return () => { window.history.pushState = originalPush }
  }, [isFormDirty])

  // Block browser tab close / refresh
  useEffect(() => {
    if (!isFormDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isFormDirty])

  const handleLeaveConfirm = () => {
    setShowLeaveDialog(false)
    if (pendingNavPath) {
      // reset form dirty state so the pushState override won't re-trigger
      reset(getValues(), { keepValues: true })
      try {
        // Use location.assign to ensure navigation goes to the originally intended URL
        window.location.assign(pendingNavPath)
      } catch {
        // Fallback to react-router navigate for relative paths
        try { navigate(pendingNavPath) } catch { /* swallow */ }
      }
    }
    setPendingNavPath(null)
  }

  const handleLeaveDiscard = () => {
    setShowLeaveDialog(false)
    setPendingNavPath(null)
  }

  const patientSearchTerm = patient.newData.phone?.trim() || patient.newData.fullName?.trim() || ''
  usePatientSearch(patientSearchTerm)
  const { data: patientPrescriptions } = usePrescriptionFetch(patient.existingId || undefined)
  const { isScannerOpen: barcodeScannerOpen, openScanner, closeScanner, scanBarcode, isScanningProduct } = useBarcodeScanner()
  const { fields: expenseFields, append, remove } = useFieldArray({ control, name: 'expenses' })

  // Derived options
  const frameOptions = useMemo<LookupOption[]>(() => {
    return (productData?.data || [])
      .filter((p) => ['frames', 'sunglasses'].includes(p.category.toLowerCase()) && p.current_stock > 0)
      .map((p) => ({ value: p.product_id, label: p.name, subtitle: `${p.sku}${p.barcode ? ` • ${p.barcode}` : ''} • ${formatCurrency(p.selling_price)}` }))
  }, [productData])

  const lensOptions = useMemo<LookupOption[]>(() =>
    (lensMasterData?.data || []).map((l) => ({ value: l.id, label: l.lens_type, subtitle: `${l.color} • ${l.size} • ${l.lens_code} • ${formatCurrency(l.price)}` }))
  , [lensMasterData])

  const expenseOptions = useMemo<LookupOption[]>(() =>
    (expenseMasterData?.data || []).map((e) => ({ value: e.id, label: e.name, subtitle: formatCurrency(e.default_cost) }))
  , [expenseMasterData])

  const testedByOptions = useMemo(() => {
    const list: any[] = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
    return (list || [])
      .filter((u) => u && u.is_active)
      .map((u) => ({ value: u.user_id, label: u.name }))
  }, [usersData])

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
      discountType: totals.discountType,
      advancedPayment: Number(totals.advancedPayment || 0),
      isOldOrder: salesOrder.isOld,
    })
  , [expenses, frame.total, lens.total, salesOrder.isOld, totals.advancedPayment, totals.discount, totals.discountType])

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
    if (salesOrder.deliveryDate) {
      setValue('salesOrder.dateOfFullPayment', salesOrder.deliveryDate, { shouldDirty: false, shouldValidate: false })
    }
  }, [salesOrder.deliveryDate, setValue])

  useEffect(() => {
    if (prescription.existingId || prescription.newData.diagnosis || prescription.newData.notes) clearErrors('prescription')
  }, [clearErrors, prescription.existingId, prescription.newData.diagnosis, prescription.newData.notes])

  // Auto-load latest prescription when a patient is linked (but don't override if a prescription is already selected)
  useEffect(() => {
    if (!patient.existingId) return
    if (prescription.existingId) return
    const latest = (patientPrescriptions?.data || [])[0]
    if (latest) {
      setValue('prescription.existingId', latest.prescription_id, { shouldDirty: false, shouldValidate: false })
      setValue('prescription.newData', mapPrescriptionToForm(latest), { shouldDirty: false, shouldValidate: false })
    } else {
      // no previous prescriptions — ensure manual empty state
      setValue('prescription.existingId', '', { shouldDirty: false, shouldValidate: false })
      setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: false, shouldValidate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.existingId, patientPrescriptions?.data])

  useEffect(() => {
    if (!frame.total || frame.total <= 0) return
    let cancelled = false
    basicDataApi.suggestComplimentary(frame.total).then((item) => {
      if (cancelled) return
      setSuggestedCase(item)
      if (item && !selectedCaseId) setSelectedCaseId(item.product_id)
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.total])

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

  // Draft loading
  const { data: draftOrder, isLoading: isLoadingDraft } = useQuery({
    queryKey: ['sales-order-draft', draftOrderId],
    queryFn: () => salesOrdersApi.getById(draftOrderId!),
    enabled: !!draftOrderId,
    staleTime: Infinity,
  })

  const { data: draftPatient } = useQuery({
    queryKey: ['patient', draftOrder?.patient_id],
    queryFn: () => patientsApi.getById(draftOrder!.patient_id),
    enabled: !!draftOrder?.patient_id,
    staleTime: Infinity,
  })

  const { data: draftPrescription } = useQuery({
    queryKey: ['prescription', draftOrder?.prescription_id],
    queryFn: () => prescriptionsApi.getById(draftOrder!.prescription_id!),
    enabled: !!draftOrder?.prescription_id,
    staleTime: Infinity,
  })

  // Pre-fill form once draft + patient data are loaded
  const draftLoaded = !!draftOrder && (draftOrder.prescription_id ? !!draftPrescription : true) && !!draftPatient
  useEffect(() => {
    if (!draftLoaded) return
    const mapped = mapDraftToFormValues(draftOrder, draftPatient ?? null, draftPrescription ?? null)
    reset(mapped, { keepDirty: false })
    // Restore frame source if draft used a frame variant
    const draftFrameItem = draftOrder.items.find((i) => i.line_type === 'frame')
    if (draftFrameItem?.frame_variant_id) {
      setFrameSource('variant')
      frameVariantsApi.getById(draftFrameItem.frame_variant_id).then(setSelectedFrameVariant).catch(() => {})
    }
    const compItems = draftOrder.items.filter((i) => i.line_type === 'complimentary')
    const draftCase = compItems[0] ?? null
    const draftBag  = compItems[1] ?? null
    if (draftCase) { setIncludeCase(true); setSelectedCaseId(draftCase.product_id) }
    else setIncludeCase(false)
    if (draftBag) { setIncludeBag(true); setSelectedBagId(draftBag.product_id) }
    else setIncludeBag(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded])

  // Mutations
  const createPatientMutation = useMutation({ mutationFn: (p: Parameters<typeof patientsApi.create>[0]) => patientsApi.create(p) })
  const createPrescriptionMutation = useMutation({ mutationFn: (p: Parameters<typeof prescriptionsApi.create>[0]) => prescriptionsApi.create(p) })
  const createSalesOrderMutation = useMutation({ mutationFn: (p: Parameters<typeof salesOrdersApi.create>[0]) => salesOrdersApi.create(p) })
  const updateSalesOrderMutation = useMutation({ mutationFn: ({ id, data }: { id: string; data: Parameters<typeof salesOrdersApi.update>[1] }) => salesOrdersApi.update(id, data) })
  const generateInvoiceMutation = useMutation({ mutationFn: (orderId: string) => salesOrdersApi.generateInvoice(orderId) })

  // Handlers
  const applyFrameSelection = (product: Product) => setValue('frame', mapProductToFrame(product), { shouldDirty: true, shouldValidate: true })

  const applyFrameVariantSelection = (variant: FrameVariant | null) => {
    setSelectedFrameVariant(variant)
    if (variant) {
      setValue('frame', {
        selectionId: variant.variant_id,
        barcode: variant.barcode || variant.sku,
        model: `${variant.frame_master_ref.brand} ${variant.frame_master_ref.model_code}`,
        color: variant.color,
        size: String(variant.eye_size),
        frameId: variant.sku,
        total: variant.selling_price,
      }, { shouldDirty: true, shouldValidate: true })
    } else {
      setValue('frame', defaultValues.frame, { shouldDirty: true, shouldValidate: false })
    }
  }

  const applyLensSelection = (lensType: NonNullable<typeof lensMasterData>['data'][number]) => {
    setValue('lens.selectionId', lensType.id, { shouldDirty: true, shouldValidate: true })
    setValue('lens.lensType', lensType.lens_type, { shouldDirty: true, shouldValidate: true })
    setValue('lens.color', lensType.color, { shouldDirty: true, shouldValidate: true })
    setValue('lens.size', lensType.size, { shouldDirty: true, shouldValidate: true })
    setValue('lens.lensId', lensType.lens_code, { shouldDirty: true, shouldValidate: true })
    setValue('lens.total', lensType.price, { shouldDirty: true, shouldValidate: true })
  }

  const buildPrescriptionPayloadForCreate = (patientId: string, presValues: SalesOrderIntakeValues['prescription'], testedById?: string) => {
    const base = buildPrescriptionPayload(patientId, presValues as any)
    const list: any[] = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
    const matched = testedById ? list.find((u) => String(u.user_id) === String(testedById)) : undefined
    return {
      ...base,
      doctor_id: matched?.user_id || (testedById || ''),
      doctor_name: matched?.name || (''),
      patient_name: undefined,
      diagnosis: presValues.newData.diagnosis || 'Walk-in intake',
    }
  }

  const handlePatientAction = (rec: Patient) => {
    setValue('patient.existingId', rec.patient_id, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.fullName', rec.name, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.phone', rec.phone, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.email', rec.email || '', { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.age', rec.age, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.gender', rec.gender, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.address', formatAddress(rec), { shouldDirty: true, shouldValidate: true })
    toast.success(`Linked to ${rec.name}`)
  }

  const unlinkPatient = () => {
    setValue('patient.existingId', '', { shouldDirty: true, shouldValidate: true })
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
      // Try frame variant inventory first
      const variant = await frameVariantsApi.scanLookup(barcode).catch(() => null)
      if (variant) {
        setFrameSource('variant')
        applyFrameVariantSelection(variant)
        toast.success(`Frame variant loaded: ${variant.frame_master_ref.brand} ${variant.frame_master_ref.model_code}`)
        closeScanner()
        return
      }
      // Fall back to legacy product catalog
      const product = await scanBarcode(barcode)
      if (!product) { toast.error('Frame not found for this barcode'); return }
      setFrameSource('catalog')
      applyFrameSelection(product)
      toast.success(`Frame loaded: ${product.name}`)
      closeScanner()
    } catch {
      toast.error('Frame not found for this barcode')
    }
  }

  const handleNext = async () => {
    // Step 0: Patient — validate required fields, then check for duplicates
    if (currentStep === 0) {
      const valid = await trigger(['patient.newData.fullName', 'patient.newData.phone'] as any)
      if (!valid) return
      if (!patientIsLinked) {
        const phone = patient.newData.phone?.trim() || ''
        const name = patient.newData.fullName?.trim() || ''
        const searchTerm = phone || name
        if (searchTerm) {
          try {
            // Use queryClient.fetchQuery with the same key as usePatientSearch so react-query
            // deduplicates at its own level — avoids the axios AbortController race where the
            // debounce fires and cancels this in-flight request before we can read the result.
            const result = await queryClient.fetchQuery({
              queryKey: ['patients', 'search', searchTerm],
              queryFn: () => patientsApi.getAll({ page: 1, page_size: 25, search: searchTerm }),
              staleTime: 10_000,
            })
            const results = result.data || []
            const match =
              results.find((item) => phoneDigits(safeText(item?.phone)) === phoneDigits(phone)) ||
              results.find((item) => name && normalizeText(safeText(item?.name)).includes(normalizeText(name))) ||
              null
            if (match) {
              setFreshMatchedPatient(match)
              setShowDuplicateDialog(true)
              return
            }
          } catch {
            // ignore — let the form proceed if search fails
          }
        }
      }
    }
    // Step 5: Order Info — validate required fields
    if (currentStep === 5) {
      const valid = await trigger(['salesOrder.orderDate', 'salesOrder.deliveryDate', 'salesOrder.testedBy'] as any)
      if (!valid) return
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0))

  const handleReset = () => { reset(defaultValues); setSavedOrderNumber(''); setSavedInvoice(null); setCurrentStep(0); setMaxStepReached(0) }

  const handleSubmitClick = async () => {
    const isValid = await trigger()
    if (!isValid) {
      toast.error('Some required fields are missing or invalid. Please review each step before submitting.')
      return
    }
    setShowSaveDialog(true)
  }

  const handleSaveDraft = async () => {
    const isValid = await trigger()
    if (!isValid) {
      setShowSaveDialog(false)
      return
    }
    setShowSaveDialog(false)
    handleSubmit(onSubmit)()
  }

  const saveDraftAndLeave = async () => {
    const values = getValues()
    const patientName = values.patient.newData.fullName?.trim()
    const patientPhone = values.patient.newData.phone?.trim()
    const hasPatient = !!(values.patient.existingId || (patientName && patientPhone))

    if (!hasPatient) {
      toast.error('Please enter at least a patient name and phone number before saving a draft.')
      return
    }

    const draftItems: SalesOrderItem[] = []
    if (frameSource === 'variant' && selectedFrameVariant) {
      draftItems.push({ product_id: selectedFrameVariant.variant_id, product_name: values.frame.model || `${selectedFrameVariant.frame_master_ref.brand} ${selectedFrameVariant.frame_master_ref.model_code}`, sku: selectedFrameVariant.sku, quantity: 1, unit_price: Number(values.frame.total || selectedFrameVariant.selling_price), total: Number(values.frame.total || selectedFrameVariant.selling_price), master_data_id: selectedFrameVariant.frame_master_id, frame_variant_id: selectedFrameVariant.variant_id, line_type: 'frame', track_stock: true })
    } else if (resolvedFrame) {
      draftItems.push({ product_id: resolvedFrame.product_id, product_name: values.frame.model || resolvedFrame.name, sku: values.frame.frameId || resolvedFrame.sku, quantity: 1, unit_price: Number(values.frame.total || resolvedFrame.selling_price), total: Number(values.frame.total || resolvedFrame.selling_price), master_data_id: resolvedFrame.product_id, line_type: 'product', track_stock: true })
    }
    if (resolvedLens) {
      draftItems.push({ product_id: resolvedLens.id, product_name: values.lens.lensType || resolvedLens.lens_type, sku: values.lens.lensId || resolvedLens.lens_code, quantity: 1, unit_price: Number(values.lens.total || resolvedLens.price), total: Number(values.lens.total || resolvedLens.price), master_data_id: resolvedLens.id, line_type: 'lens', track_stock: false })
    }
    values.expenses.forEach((expense) => {
      if (!expense.expenseTypeId && !expense.expenseTypeName) return
      if (Number(expense.qty || 0) <= 0) return
      const sel = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
      draftItems.push({ product_id: expense.expenseTypeId || 'EXPENSE', product_name: expense.expenseTypeName || sel?.name || 'Expense', sku: expense.expenseTypeId || 'EXPENSE', quantity: Number(expense.qty), unit_price: Number(expense.unitCost || 0), total: calculateLineTotal({ qty: Number(expense.qty), unitCost: Number(expense.unitCost || 0), discount: Number(expense.discount || 0) }), master_data_id: sel?.id || expense.expenseTypeId || undefined, line_type: 'expense', track_stock: false })
    })
    if (includeCase && selectedCaseId) {
      const caseItem = productData?.data.find((p) => p.product_id === selectedCaseId)
      if (caseItem) draftItems.push({ product_id: caseItem.product_id, product_name: caseItem.name, sku: caseItem.sku, quantity: 1, unit_price: 0, total: 0, master_data_id: caseItem.product_id, line_type: 'complimentary', track_stock: true })
    }
    if (includeBag && selectedBagId) {
      const bagItem = productData?.data.find((p) => p.product_id === selectedBagId)
      if (bagItem) draftItems.push({ product_id: bagItem.product_id, product_name: bagItem.name, sku: bagItem.sku, quantity: 1, unit_price: 0, total: 0, master_data_id: bagItem.product_id, line_type: 'complimentary', track_stock: true })
    }

    if (draftItems.length === 0) {
      // Nothing selectable yet — just discard and navigate
      handleLeaveConfirm()
      return
    }

    setIsSavingDraft(true)
    try {
      const patientId = values.patient.existingId || (await createPatientMutation.mutateAsync(buildPatientPayload(values.patient))).patient_id

      const createdOrder = await createSalesOrderMutation.mutateAsync({
        patient_id: patientId,
        prescription_id: values.prescription.existingId || undefined,
        tested_by: values.salesOrder.testedBy || undefined,
        expected_delivery_date: `${values.salesOrder.deliveryDate}T00:00:00Z`,
        date_of_full_payment: `${values.salesOrder.dateOfFullPayment}T00:00:00Z`,
        notes: values.remarks.trim() || undefined,
        measurements: { order_date: values.salesOrder.orderDate, frame_total: values.frame.total, lens_total: values.lens.total },
        status: 'draft' as const,
        items: draftItems,
      })

      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(`Draft saved as ${createdOrder.order_number}`)
      handleLeaveConfirm()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to save draft')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const onSubmit = async (values: SalesOrderIntakeValues) => {
    let createdPatientId: string | null = null
    let createdPrescriptionId: string | null = null
    try {
      const phone = phoneDigits(values.patient.newData.phone)
      const exactDuplicate = !values.patient.existingId && freshMatchedPatient && phoneDigits(safeText(freshMatchedPatient.phone)) === phone
      if (exactDuplicate) { toast.error('Phone number already exists. Please link the existing patient or use a different number.'); return }

      const patientId = values.patient.existingId || (await createPatientMutation.mutateAsync(buildPatientPayload(values.patient))).patient_id
      if (!values.patient.existingId) createdPatientId = patientId

      const shouldCreateRx = !values.prescription.existingId && Boolean(
        values.prescription.newData.diagnosis.trim() || values.prescription.newData.notes.trim() ||
        values.prescription.newData.rightEye.sphere !== 0 || values.prescription.newData.rightEye.cylinder !== 0 ||
        values.prescription.newData.leftEye.sphere !== 0 || values.prescription.newData.leftEye.cylinder !== 0
      )
      let prescriptionId = values.prescription.existingId || ''
      if (shouldCreateRx) {
        const createdRx = await createPrescriptionMutation.mutateAsync(buildPrescriptionPayloadForCreate(patientId, values.prescription, values.salesOrder.testedBy))
        prescriptionId = createdRx.prescription_id
        createdPrescriptionId = prescriptionId
      }

      const frameItem = resolvedFrame
      if (!values.salesOrder.isOld && !frameItem && !(frameSource === 'variant' && selectedFrameVariant)) { toast.error('Frame selection is required'); return }
      const lensItem = resolvedLens
      if (!values.salesOrder.isOld && !lensItem) { toast.error('Lens selection is required'); return }
      if (!values.salesOrder.isOld) {
        const invalidExpense = (values.expenses || []).some((e) => !e.expenseTypeId || !expenseMasterData?.data.some((item) => item.id === e.expenseTypeId))
        if (invalidExpense) { toast.error('Expense type must come from master data'); return }
      }

      const itemPayload: SalesOrderItem[] = []
      if (frameSource === 'variant' && selectedFrameVariant) {
        itemPayload.push({
          product_id: selectedFrameVariant.variant_id,
          product_name: values.frame.model || `${selectedFrameVariant.frame_master_ref.brand} ${selectedFrameVariant.frame_master_ref.model_code}`,
          sku: selectedFrameVariant.sku,
          quantity: 1,
          unit_price: Number(values.frame.total || selectedFrameVariant.selling_price),
          total: Number(values.frame.total || selectedFrameVariant.selling_price),
          master_data_id: selectedFrameVariant.frame_master_id,
          frame_variant_id: selectedFrameVariant.variant_id,
          line_type: 'frame' as const,
          track_stock: true,
        })
      } else if (frameItem) {
        itemPayload.push({ product_id: frameItem.product_id, product_name: values.frame.model || frameItem.name, sku: values.frame.frameId || frameItem.sku, quantity: 1, unit_price: Number(values.frame.total || frameItem.selling_price), total: Number(values.frame.total || frameItem.selling_price), master_data_id: frameItem.product_id, line_type: 'product' as const, track_stock: true })
      }
      if (lensItem) {
        itemPayload.push({ product_id: lensItem.id, product_name: values.lens.lensType || lensItem.lens_type, sku: values.lens.lensId || lensItem.lens_code, quantity: 1, unit_price: Number(values.lens.total || lensItem.price), total: Number(values.lens.total || lensItem.price), master_data_id: lensItem.id, line_type: 'lens' as const, track_stock: false })
      }
      itemPayload.push(...(values.expenses || []).filter((expense) => Number(expense.qty || 0) > 0).map((expense) => {
        const sel = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
        return { product_id: expense.expenseTypeId || 'EXPENSE', product_name: expense.expenseTypeName || sel?.name || 'Expense', sku: expense.expenseTypeId || 'EXPENSE', quantity: Number(expense.qty || 0), unit_price: Number(expense.unitCost || 0), total: calculateLineTotal({ qty: Number(expense.qty || 0), unitCost: Number(expense.unitCost || 0), discount: Number(expense.discount || 0) }), master_data_id: sel?.id || expense.expenseTypeId || undefined, line_type: 'expense' as const, track_stock: false }
      }))

      if (!values.salesOrder.isOld) {
        if (includeCase && selectedCaseId) {
          const caseItem = productData?.data.find((p) => p.product_id === selectedCaseId)
          if (caseItem) itemPayload.push({ product_id: caseItem.product_id, product_name: caseItem.name, sku: caseItem.sku, quantity: 1, unit_price: 0, total: 0, master_data_id: caseItem.product_id, line_type: 'complimentary' as const, track_stock: true })
        }
        if (includeBag && selectedBagId) {
          const bagItem = productData?.data.find((p) => p.product_id === selectedBagId)
          if (bagItem) itemPayload.push({ product_id: bagItem.product_id, product_name: bagItem.name, sku: bagItem.sku, quantity: 1, unit_price: 0, total: 0, master_data_id: bagItem.product_id, line_type: 'complimentary' as const, track_stock: true })
        }
      }

      if (itemPayload.length === 0) {
        toast.error('At least one item (frame, lens, or expense) is required to create a sales order.')
        return
      }

      const convertDateToISO = (dateStr: string) => dateStr ? `${dateStr}T00:00:00Z` : undefined

      const orderPayload = {
        patient_id: patientId,
        prescription_id: prescriptionId || undefined,
        tested_by: values.salesOrder.testedBy,
        expected_delivery_date: convertDateToISO(values.salesOrder.deliveryDate),
        date_of_full_payment: convertDateToISO(values.salesOrder.dateOfFullPayment),
        notes: [values.remarks.trim(), values.salesOrder.isOld ? `Legacy SO Number: ${values.salesOrder.orderNumber || 'manual entry'}` : ''].filter(Boolean).join('\n'),
        measurements: { order_date: values.salesOrder.orderDate, order_type: isFullOrder ? 'FULL_ORDER' : 'PARTIAL_ORDER', frame_total: values.frame.total, lens_total: values.lens.total, other_expenses_total: derivedTotals.expenseTotal, discount: derivedTotals.discountTotal, advance_payment: values.totals.advancedPayment },
        status: 'created' as const,
        items: itemPayload,
      }

      const savedOrder = draftOrderId
        ? await updateSalesOrderMutation.mutateAsync({ id: draftOrderId, data: { ...orderPayload, status: 'created' } })
        : await createSalesOrderMutation.mutateAsync(orderPayload)
      setSavedOrderNumber(savedOrder.order_number)
      setValue('salesOrder.orderNumber', savedOrder.order_number, { shouldDirty: false, shouldValidate: false })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', patientId] })

      if (!values.salesOrder.isOld) {
        const invoice = await generateInvoiceMutation.mutateAsync(savedOrder.order_id)
        setSavedInvoice(invoice)
        setValue('totals.invoiceNumber', invoice.invoice_number, { shouldDirty: false, shouldValidate: false })
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        toast.success(`Invoice ${invoice.invoice_number} generated`)
      } else {
        setSavedInvoice(null)
        toast.success(`Historical SO saved as ${savedOrder.order_number}`)
      }
    } catch (error: any) {
      if (createdPrescriptionId) {
        try {
          await prescriptionsApi.delete(createdPrescriptionId)
        } catch {
          // ignore rollback failures; original error is the one we report
        }
      }
      if (createdPatientId) {
        try {
          await patientsApi.delete(createdPatientId)
        } catch {
          // ignore rollback failures; original error is the one we report
        }
      }
      toast.error(error?.response?.data?.detail || 'Failed to save sales order')
    }
  }

  if (isLoadingProducts || (draftOrderId && isLoadingDraft)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-border bg-card">
        <Loading text={isLoadingDraft ? 'Loading draft order...' : 'Loading sales order masters...'} />
      </div>
    )
  }

  const isSaving = createPatientMutation.isPending || createPrescriptionMutation.isPending || createSalesOrderMutation.isPending || updateSalesOrderMutation.isPending || generateInvoiceMutation.isPending
  const showPricingPanel = currentStep >= 2 && currentStep <= 5

  return (
    <>
      <QRScanner isOpen={barcodeScannerOpen} onScan={handleBarcodeScan} onClose={closeScanner} />

      <SaveRecordDialog
        isOpen={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        recordName="sales order"
        isCreating={true}
        confirmLabel="Create Order"
        onSaveDraft={handleSaveDraft}
        onCancel={() => setShowSaveDialog(false)}
      />

      {/* Navigate-away guard dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={(open) => { if (!open) handleLeaveDiscard() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RiSaveLine className="h-5 w-5 text-primary" />
              Unsaved sales order
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save this order as a draft before leaving, or discard your progress?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              onClick={handleLeaveDiscard}
              className="w-full sm:w-auto transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Stay
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleLeaveConfirm}
              className="w-full sm:w-auto transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-destructive"
            >
              Discard &amp; Leave
            </Button>
            <AlertDialogAction
              disabled={isSavingDraft}
              onClick={saveDraftAndLeave}
              className="w-full sm:w-auto transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isSavingDraft
                ? <><RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />Saving Draft...</>
                : 'Save as Draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate patient dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing patient found</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>A patient record already exists matching this information:</p>
                <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                  <p className="font-semibold text-foreground">{safeText(freshMatchedPatient?.name)}</p>
                  <p className="text-muted-foreground">{safeText(freshMatchedPatient?.phone)}</p>
                </div>
                <p>Would you like to use this existing patient, or continue creating a new record with a different phone number?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Stay &amp; Edit</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setValue('patient.existingId', '', { shouldDirty: true, shouldValidate: true })
                setShowDuplicateDialog(false)
                setCurrentStep(1)
              }}
            >
              Create New Patient
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (freshMatchedPatient) handlePatientAction(freshMatchedPatient)
                setShowDuplicateDialog(false)
                setCurrentStep(1)
              }}
            >
              Use Existing Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Draft edit banner */}
        {draftOrderId && draftOrder && !savedOrderNumber && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
            <RiFileEditLine className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Editing draft — {draftOrder.order_number}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Complete all steps and click "Create Order" to confirm this order and generate an invoice.
              </p>
            </div>
          </div>
        )}

        {/* Progress stepper */}
        <Card className="px-6 py-5">
          <StepIndicator currentStep={currentStep} maxStepReached={maxStepReached} onStepClick={setCurrentStep} />
        </Card>

        <form className="space-y-4">
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
                  <Field label="Email" error={errors.patient?.newData?.email?.message as string | undefined}>
                    <Input placeholder="name@example.com" {...register('patient.newData.email')} disabled={patientIsLinked} />
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

                {patientIsLinked && (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RiCheckLine className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Patient linked: {patient.newData.fullName}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={unlinkPatient}>Unlink</Button>
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
                    <p className="text-sm text-muted-foreground mt-0.5">Modern optical POS workflow for fast, accurate data entry</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-8">
                {/* Prescription Source Selection Tabs */}
                <Tabs defaultValue="manual" value={prescription.existingId ? 'existing' : 'manual'} onValueChange={(tab) => {
                  if (tab === 'manual') {
                    setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: true })
                    setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false })
                  }
                }} className="w-full">
                  <TabsList className={`grid w-full mb-8 ${patient.existingId ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {patient.existingId && (
                      <TabsTrigger value="existing" className="gap-2">
                        <RiFileTextLine className="h-4 w-4" />
                        Existing
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="manual" className="gap-2">
                      <RiEyeLine className="h-4 w-4" />
                      Manual Entry
                    </TabsTrigger>
                  </TabsList>

                  {/* Existing Prescription Tab */}
                  {patient.existingId && (
                    <TabsContent value="existing" className="w-full space-y-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-foreground">Select Previous Prescription</Label>
                        <Select
                          value={prescription.existingId || ''}
                          onValueChange={(selectedId) => {
                            setValue('prescription.existingId', selectedId, { shouldDirty: true, shouldValidate: true })
                            const rx = (patientPrescriptions?.data || []).find((item) => item.prescription_id === selectedId)
                            if (rx) setValue('prescription.newData', mapPrescriptionToForm(rx), { shouldDirty: true, shouldValidate: false })
                          }}
                        >
                          <SelectTrigger className="h-11"><SelectValue placeholder="Select a prescription" /></SelectTrigger>
                          <SelectContent>
                            {(patientPrescriptions?.data || []).map((item) => (
                              <SelectItem key={item.prescription_id} value={item.prescription_id}>
                                {item.prescription_date ? String(item.prescription_date).split('T')[0] : item.prescription_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {prescriptionIsLinked && (
                        <div>
                          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 px-4 py-3 mt-4 flex items-center justify-between">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                              <RiCheckLine className="h-4 w-4" />
                              Prescription loaded successfully
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const latest = (patientPrescriptions?.data || []).find((r) => r.prescription_id === prescription.existingId) || (patientPrescriptions?.data || [])[0]
                                  setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: true })
                                  setValue('prescription.newData', latest ? mapPrescriptionToForm(latest) : defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false })
                                }}
                              >
                                Add New Prescription
                              </Button>
                            </div>
                          </div>

                          {/* Read-only prescription details */}
                          <div className="mt-4">
                            {(() => {
                              const selected = (patientPrescriptions?.data || []).find((r) => r.prescription_id === prescription.existingId) || (patientPrescriptions?.data || [])[0]
                              if (!selected) return <p className="text-sm text-muted-foreground">No previous prescription details available.</p>
                              const form = mapPrescriptionToForm(selected)
                              return (
                                <div className="space-y-4">
                                  {/* Rx table — read-only */}
                                  <div className="overflow-x-auto rounded-lg border border-border/60">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-muted/50 border-b border-border/60">
                                          <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground w-20"></th>
                                          {['Sphere', 'Cylinder', 'Axis', 'Add', 'PD'].map((col) => (
                                            <th key={col} className="py-2.5 px-3 text-center font-semibold text-muted-foreground uppercase tracking-wide text-xs">{col}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr className="border-b border-border/40 bg-primary/5">
                                          <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="default" className="bg-primary/20 text-primary border-primary/40 font-bold text-xs">OD</Badge>
                                              <span className="text-xs text-muted-foreground hidden sm:inline">Right</span>
                                            </div>
                                          </td>
                                          {[form.rightEye.sphere, form.rightEye.cylinder, form.rightEye.axis, form.rightEye.add, form.rightEye.pd].map((val, i) => (
                                            <td key={i} className="py-3 px-3 text-center font-medium tabular-nums">{String(val) || '—'}</td>
                                          ))}
                                        </tr>
                                        <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                                          <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="bg-blue-100/60 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-bold text-xs">OS</Badge>
                                              <span className="text-xs text-muted-foreground hidden sm:inline">Left</span>
                                            </div>
                                          </td>
                                          {[form.leftEye.sphere, form.leftEye.cylinder, form.leftEye.axis, form.leftEye.add, form.leftEye.pd].map((val, i) => (
                                            <td key={i} className="py-3 px-3 text-center font-medium tabular-nums">{String(val) || '—'}</td>
                                          ))}
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Diagnosis</p>
                                      <p className="text-sm text-foreground">{form.diagnosis || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                                      <p className="text-sm text-foreground">{form.notes || '—'}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )}

                  {/* Manual Entry Tab */}
                  <TabsContent value="manual" className="w-full space-y-5">
                    {/* Rx date row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rx Date</Label>
                        <Input type="date" className="h-9" {...register('prescription.newData.prescriptionDate')} disabled={prescriptionIsLinked} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valid Until</Label>
                        <Input type="date" className="h-9" {...register('prescription.newData.validUntil')} disabled={prescriptionIsLinked} />
                      </div>
                    </div>

                    {/* Prescription table — OD / OS rows */}
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border/60">
                            <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-muted-foreground w-24 shrink-0">Eye</th>
                            {[
                              { label: 'Sphere', hint: '±0.25' },
                              { label: 'Cylinder', hint: '±0.25' },
                              { label: 'Axis', hint: '1–180' },
                              { label: 'Add', hint: '0–4' },
                              { label: 'PD', hint: 'mm' },
                            ].map(({ label, hint }) => (
                              <th key={label} className="py-2.5 px-2 text-center font-semibold text-muted-foreground">
                                <div className="text-xs uppercase tracking-wide">{label}</div>
                                <div className="text-[10px] font-normal text-muted-foreground/60">{hint}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* OD — Right Eye */}
                          <tr className="border-b border-border/40 bg-primary/5">
                            <td className="pl-4 pr-2 py-3">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="default" className="bg-primary/20 text-primary border-primary/40 font-bold text-xs w-fit">OD</Badge>
                                <span className="text-[10px] text-muted-foreground">Right</span>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <div className="space-y-1">
                                <Input
                                  type="text"
                                  placeholder="0.00"
                                  className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                  {...register('prescription.newData.rightEye.sphere')}
                                  disabled={prescriptionIsLinked}
                                  onKeyDown={(e) => {
                                    if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.sphere')) || 0; setValue('prescription.newData.rightEye.sphere', v + 0.25) }
                                    if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.sphere')) || 0; setValue('prescription.newData.rightEye.sphere', v - 0.25) }
                                  }}
                                />
                                <div className="flex gap-1">
                                  <button type="button" disabled={prescriptionIsLinked} onClick={() => setValue('prescription.newData.rightEye.sphere', 'PLANO' as any, { shouldDirty: true })} className="flex-1 text-[10px] font-semibold rounded border border-border/60 bg-muted/60 hover:bg-muted py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">PL</button>
                                  <button type="button" disabled={prescriptionIsLinked} onClick={() => setValue('prescription.newData.rightEye.sphere', 'NPL' as any, { shouldDirty: true })} className="flex-1 text-[10px] font-semibold rounded border border-border/60 bg-muted/60 hover:bg-muted py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">NPL</button>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.cylinder')) || 0; setValue('prescription.newData.rightEye.cylinder', v + 0.25) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.cylinder')) || 0; setValue('prescription.newData.rightEye.cylinder', v - 0.25) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="1" placeholder="0" className="text-center h-9 font-medium tabular-nums min-w-[60px]"
                                {...register('prescription.newData.rightEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.axis')) || 0; setValue('prescription.newData.rightEye.axis', (v + 1) % 181) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.axis')) || 0; setValue('prescription.newData.rightEye.axis', v === 0 ? 180 : v - 1) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.add')) || 0; setValue('prescription.newData.rightEye.add', Math.min(v + 0.25, 4)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.add')) || 0; setValue('prescription.newData.rightEye.add', Math.max(v - 0.25, 0)) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.5" placeholder="0.0" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.pd')) || 0; setValue('prescription.newData.rightEye.pd', Math.min(v + 0.5, 75)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.pd')) || 0; setValue('prescription.newData.rightEye.pd', Math.max(v - 0.5, 50)) }
                                }} />
                            </td>
                          </tr>

                          {/* OS — Left Eye */}
                          <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                            <td className="pl-4 pr-2 py-3">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="secondary" className="bg-blue-100/60 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-bold text-xs w-fit">OS</Badge>
                                <span className="text-[10px] text-muted-foreground">Left</span>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <div className="space-y-1">
                                <Input
                                  type="text"
                                  placeholder="0.00"
                                  className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                  {...register('prescription.newData.leftEye.sphere')}
                                  disabled={prescriptionIsLinked}
                                  onKeyDown={(e) => {
                                    if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.sphere')) || 0; setValue('prescription.newData.leftEye.sphere', v + 0.25) }
                                    if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.sphere')) || 0; setValue('prescription.newData.leftEye.sphere', v - 0.25) }
                                  }}
                                />
                                <div className="flex gap-1">
                                  <button type="button" disabled={prescriptionIsLinked} onClick={() => setValue('prescription.newData.leftEye.sphere', 'PLANO' as any, { shouldDirty: true })} className="flex-1 text-[10px] font-semibold rounded border border-border/60 bg-muted/60 hover:bg-muted py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">PL</button>
                                  <button type="button" disabled={prescriptionIsLinked} onClick={() => setValue('prescription.newData.leftEye.sphere', 'NPL' as any, { shouldDirty: true })} className="flex-1 text-[10px] font-semibold rounded border border-border/60 bg-muted/60 hover:bg-muted py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">NPL</button>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.cylinder')) || 0; setValue('prescription.newData.leftEye.cylinder', v + 0.25) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.cylinder')) || 0; setValue('prescription.newData.leftEye.cylinder', v - 0.25) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="1" placeholder="0" className="text-center h-9 font-medium tabular-nums min-w-[60px]"
                                {...register('prescription.newData.leftEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.axis')) || 0; setValue('prescription.newData.leftEye.axis', (v + 1) % 181) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.axis')) || 0; setValue('prescription.newData.leftEye.axis', v === 0 ? 180 : v - 1) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.add')) || 0; setValue('prescription.newData.leftEye.add', Math.min(v + 0.25, 4)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.add')) || 0; setValue('prescription.newData.leftEye.add', Math.max(v - 0.25, 0)) }
                                }} />
                            </td>
                            <td className="px-2 py-3">
                              <Input type="number" step="0.5" placeholder="0.0" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.pd')) || 0; setValue('prescription.newData.leftEye.pd', Math.min(v + 0.5, 75)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.pd')) || 0; setValue('prescription.newData.leftEye.pd', Math.max(v - 0.5, 50)) }
                                }} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">Use <kbd className="px-1 py-0.5 rounded border border-border/60 bg-muted text-[10px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded border border-border/60 bg-muted text-[10px] font-mono">↓</kbd> arrow keys to step values in any field.</p>

                    {/* Clinical Notes Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis</Label>
                        <Input
                          {...register('prescription.newData.diagnosis')}
                          disabled={prescriptionIsLinked}
                          placeholder="e.g. Myopia, Hyperopia, Astigmatism"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clinical Notes</Label>
                        <Input
                          {...register('prescription.newData.notes')}
                          disabled={prescriptionIsLinked}
                          placeholder="Special instructions or observations"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Frame ───────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RiBox3Line className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Frame Selection</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Scan a barcode or pick from frame variant inventory</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                {/* Scan button always available */}
                <Button type="button" variant="outline" onClick={openScanner} disabled={isScanningProduct} className="w-full h-12 text-base gap-2">
                  <RiScanLine className="h-5 w-5" />
                  {isScanningProduct ? 'Scanning...' : 'Scan Barcode'}
                </Button>

                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">or search</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Frame source tabs */}
                <Tabs value={frameSource} onValueChange={(v) => {
                  setFrameSource(v as 'catalog' | 'variant')
                  setSelectedFrameVariant(null)
                  setValue('frame', defaultValues.frame, { shouldDirty: false, shouldValidate: false })
                }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="variant">Frame Inventory (SKU)</TabsTrigger>
                    <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
                  </TabsList>

                  {/* Frame Variant tab */}
                  <TabsContent value="variant" className="space-y-4 pt-2">
                    <Field label="Search frame variant" error={errors.frame?.selectionId?.message}>
                      <VariantPicker
                        value={selectedFrameVariant}
                        onChange={(v) => applyFrameVariantSelection(v)}
                        showStock
                        showPrice
                        placeholder="Search brand, model, color, size or scan barcode…"
                      />
                    </Field>
                    {selectedFrameVariant && (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected Variant</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <Field label="Model"><Input value={frame.model} onChange={(e) => setValue('frame.model', e.target.value, { shouldDirty: true })} placeholder="Model" /></Field>
                          <Field label="Color"><Input value={frame.color} readOnly placeholder="Color" /></Field>
                          <Field label="Size"><Input value={frame.size} readOnly placeholder="Size" /></Field>
                          <Field label="SKU"><Input value={frame.frameId} readOnly placeholder="SKU" /></Field>
                          <Field label="Price"><Input type="number" step="0.01" value={frame.total} onChange={(e) => setValue('frame.total', +e.target.value, { shouldDirty: true })} /></Field>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Product Catalog tab (legacy) */}
                  <TabsContent value="catalog" className="space-y-4 pt-2">
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Lens ────────────────────────────────────────────────── */}
          {currentStep === 3 && (
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

          {/* ── Step 4: Expenses ────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-4">
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

              {!salesOrder.isOld && (
                <Card className="border-border/60">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <RiGiftLine className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Complimentary Items</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">Free items included with this order</p>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-5 space-y-3">
                    {/* Complimentary Item 1 (e.g. Frame Case) */}
                    <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-all ${includeCase ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          id="include-case"
                          checked={includeCase}
                          onCheckedChange={(v) => setIncludeCase(!!v)}
                        />
                        <label htmlFor="include-case" className="flex items-center gap-2 cursor-pointer min-w-0">
                          <RiBriefcaseLine className="size-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">Complimentary Item 1</p>
                            {suggestedCase && selectedCaseId === suggestedCase.product_id && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <RiSparklingFill className="size-3 text-primary" />
                                Auto-suggested for this price
                              </p>
                            )}
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {includeCase && (
                          <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                            <SelectTrigger className="w-52 h-8 text-sm">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {(productData?.data || []).filter((p) => p.is_active).map((p) => (
                                <SelectItem key={p.product_id} value={p.product_id}>
                                  {p.name}
                                  <span className="ml-1 text-muted-foreground text-xs">· {p.sku}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Badge variant="secondary" className="text-xs">Free</Badge>
                      </div>
                    </div>

                    {/* Complimentary Item 2 (e.g. Carry Bag) */}
                    <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-all ${includeBag ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          id="include-bag"
                          checked={includeBag}
                          onCheckedChange={(v) => setIncludeBag(!!v)}
                        />
                        <label htmlFor="include-bag" className="flex items-center gap-2 cursor-pointer min-w-0">
                          <RiGiftLine className="size-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm font-medium text-foreground">Complimentary Item 2</p>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {includeBag && (
                          <Select value={selectedBagId} onValueChange={setSelectedBagId}>
                            <SelectTrigger className="w-52 h-8 text-sm">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {(productData?.data || []).filter((p) => p.is_active).map((p) => (
                                <SelectItem key={p.product_id} value={p.product_id}>
                                  {p.name}
                                  <span className="ml-1 text-muted-foreground text-xs">· {p.sku}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Badge variant="secondary" className="text-xs">Free</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Remarks & Notes</CardTitle></CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <Textarea {...register('remarks')} rows={4} placeholder="Add any special instructions or notes about this order..." className="resize-none" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Step 5: Order Info ──────────────────────────────────────────── */}
          {currentStep === 5 && (
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Field label="Order Date" required error={errors.salesOrder?.orderDate?.message}>
                    <Input type="date" {...register('salesOrder.orderDate')} />
                  </Field>
                  <Field label="Delivery Date" required error={errors.salesOrder?.deliveryDate?.message}>
                    <Input type="date" {...register('salesOrder.deliveryDate')} />
                  </Field>
                  <Field label="Date of Full Payment" required error={errors.salesOrder?.dateOfFullPayment?.message}>
                    <Input type="date" {...register('salesOrder.dateOfFullPayment')} />
                  </Field>
                  <Field label="Tested By" required error={errors.salesOrder?.testedBy?.message}>
                    <SearchableLOV
                      placeholder="Select user"
                      value={salesOrder.testedBy || ''}
                      onChange={(val: string) => setValue('salesOrder.testedBy', val, { shouldDirty: true, shouldValidate: true })}
                      options={(testedByOptions || []).map((u: any) => ({ value: u.value, label: u.label, subtitle: '' }))}
                    />
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

          {/* Pricing panel — visible from Frame through Order Info */}
          {showPricingPanel && <PricingPanel derivedTotals={derivedTotals} />}

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
                    {!salesOrder.isOld && (includeCase || includeBag) && (
                      <div className="py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Complimentary</span>
                          <div className="flex flex-col items-end gap-1">
                            {includeCase && selectedCaseId && (() => { const c = productData?.data.find((x) => x.product_id === selectedCaseId); return c ? <span className="text-xs text-muted-foreground">{c.name} · <span className="text-green-600 font-medium">Free</span></span> : null })()}
                            {includeBag && selectedBagId && (() => { const b = productData?.data.find((x) => x.product_id === selectedBagId); return b ? <span className="text-xs text-muted-foreground">{b.name} · <span className="text-green-600 font-medium">Free</span></span> : null })()}
                            {includeCase && !selectedCaseId && <span className="text-xs text-muted-foreground">Case · <span className="text-green-600 font-medium">Free</span></span>}
                            {includeBag && !selectedBagId && <span className="text-xs text-muted-foreground">Bag · <span className="text-green-600 font-medium">Free</span></span>}
                          </div>
                        </div>
                      </div>
                    )}
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
                      <div className="flex gap-2">
                        <Select value={totals.discountType} onValueChange={(v) => setValue('totals.discountType', v as 'AMOUNT' | 'PERCENT', { shouldDirty: true })}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AMOUNT">Amount</SelectItem>
                            <SelectItem value="PERCENT">Percent</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={0}
                          max={totals.discountType === 'PERCENT' ? 100 : undefined}
                          step="0.01"
                          placeholder={totals.discountType === 'PERCENT' ? '0 - 100' : '0.00'}
                          value={totals.discount || 0}
                          onChange={(e) => setValue('totals.discount', Number(e.target.value), { shouldDirty: true })}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="rounded-xl border-2 border-primary bg-primary/5 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding Balance</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{formatCurrency(roundCurrency(derivedTotals.balancePayment))}</p>
                  </div>

                  {!salesOrder.isOld && salesOrder.dateOfFullPayment && (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RiTimeLine className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Full Payment Due</span>
                      </div>
                      <span className="text-sm font-semibold">{salesOrder.dateOfFullPayment}</span>
                    </div>
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
                <Button type="button" disabled={isSaving} onClick={handleSubmitClick}>
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
