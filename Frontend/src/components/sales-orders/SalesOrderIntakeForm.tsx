import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
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
  RiCheckLine,
  RiUserLine,
  RiFileTextLine,
  RiBox3Line,
  RiSparklingLine,
  RiReceiptLine,
  RiShieldCheckLine,
  RiAddLine,
  RiLoader4Line,
  RiGiftLine,
  RiHistoryLine,
  RiSearchLine,
  RiCalendarLine,
  RiDownloadLine,
  RiSubtractLine,
  RiSparklingLine as RiSparklingFill,
  RiPrinterLine,
  RiToolsLine,
  RiShoppingBag3Line,
  RiCalendarCheckLine,
  RiUserHeartLine,
  RiStickyNoteLine,
  RiBuilding2Line,
  RiStethoscopeLine,
  RiCheckboxCircleLine,
} from '@remixicon/react'
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { RiSaveLine, RiFileEditLine } from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import { companyProfileApi } from '@/api/company-profile.api'
import { invoicesApi } from '@/api/invoices.api'
import InvoicePreview, { InvoicePreviewData, InvoicePreviewLine, InvoicePreviewStatus } from '@/components/sales-orders/InvoicePreview'
import OrderSummaryPanel, { OrderSummaryExtras } from '@/components/sales-orders/OrderSummaryPanel'
import PaymentPanel from '@/components/sales-orders/PaymentPanel'
import { AdvanceReceiptDialog } from '@/components/sales-orders/AdvanceReceiptDialog'
import { hasBalanceDue, receiptSlipLabel } from '@/components/sales-orders/AdvanceReceipt'
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
import { formatCurrency, formatDate } from '@/utils/formatters'
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
        email: z.union([z.literal(''), z.string().email('Invalid email address')]).optional().default(''),
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
      isOld: z.boolean().default(false),
      isReference: z.boolean().default(false),
      selectionId: z.string().optional().default(''),
      barcode: z.string().optional().default(''),
      model: z.string().optional().default(''),
      color: z.string().optional().default(''),
      size: z.string().optional().default(''),
      frameId: z.string().optional().default(''),
      frameNo: z.string().optional().default(''),
      total: requiredMoney.default(0),
    }),
    lens: z.object({
      isOld: z.boolean().default(false),
      isReference: z.boolean().default(false),
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
    saleLocation: z.enum(['institute', 'clinic']).optional(),
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
      // Lens is optional — frame only = half order, frame + lens = full order
    }
  })

type SalesOrderIntakeValues = z.infer<typeof salesOrderIntakeSchema>

interface LookupOption {
  label: string
  subtitle: string
  value: string
}

// ─── Step config ──────────────────────────────────────────────────────────────
// Order: Patient → Prescription → Frame → Lens → Extras → Order Details → Review & Pay

const STEPS = [
  { id: 0, label: 'Patient',       icon: RiUserLine,        hint: 'Find the patient or register a new one' },
  { id: 1, label: 'Prescription',  icon: RiEyeLine,         hint: 'Enter or confirm the eye measurements' },
  { id: 2, label: 'Frame',         icon: RiBox3Line,        hint: 'Scan or search the frame being sold' },
  { id: 3, label: 'Lens',          icon: RiSparklingLine,   hint: 'Optional — skip for a frame-only order' },
  { id: 4, label: 'Extras',        icon: RiReceiptLine,     hint: 'Optional — accessories, services and free items' },
  { id: 5, label: 'Order Details', icon: RiFileTextLine,    hint: 'Dates, who tested, and where it was sold' },
  { id: 6, label: 'Review & Pay',  icon: RiShieldCheckLine, hint: 'Check everything, apply discount, take payment' },
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
  const Icon = type === 'success' ? RiCheckboxCircleLine : RiAlertLine
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${styles[type]}`}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
      </div>
    </div>
  )
}

// Card heading for the Extras and Order Details sections
const SectionHeader = ({
  icon: Icon,
  title,
  description,
  tone = 'primary',
  aside,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  tone?: 'primary' | 'emerald'
  aside?: React.ReactNode
}) => (
  <CardHeader>
    {/* The aside drops below the title on narrow screens rather than squeezing it */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {aside}
    </div>
  </CardHeader>
)

const QtyStepper = ({ value, onChange, itemName }: { value: number; onChange: (qty: number) => void; itemName: string }) => (
  <div className="flex w-fit items-center rounded-md border border-border bg-background">
    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={value <= 1}
      onClick={() => onChange(value - 1)} aria-label={`One less ${itemName}`}>
      <RiSubtractLine className="size-3.5" />
    </Button>
    <span className="w-8 text-center text-sm tabular-nums">{value}</span>
    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
      onClick={() => onChange(value + 1)} aria-label={`One more ${itemName}`}>
      <RiAddLine className="size-3.5" />
    </Button>
  </div>
)

// The frame and lens price: the one field on those steps that changes the bill, so it stands out a little
const PriceField = ({ disabled, registration }: { disabled?: boolean; registration: UseFormRegisterReturn }) => (
  <Field label="Price">
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">LKR</span>
      <Input
        type="number" step="0.01" placeholder="0.00"
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        className="border-primary/40 bg-primary/5 pl-11 text-right font-semibold tabular-nums focus-visible:border-primary"
        {...registration}
      />
    </div>
  </Field>
)

const EmptyHint = ({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
    <Icon className="size-4 shrink-0" />
    <span>{children}</span>
  </div>
)

// "Ready in" shortcuts on the Order Details step, counted from the order date
const READY_IN = [['Tomorrow', 1], ['In 3 days', 3], ['In 1 week', 7], ['In 2 weeks', 14]] as const

const SALE_LOCATIONS = [
  { key: 'institute', label: 'Institute', icon: RiBuilding2Line },
  { key: 'clinic', label: 'Clinic', icon: RiStethoscopeLine },
] as const

// '' when the start date can't be read (e.g. an old draft with a non-ISO order date)
const addDaysTo = (isoDate: string, days: number) => {
  const start = parseISO(isoDate)
  return isValid(start) ? format(addDays(start, days), 'yyyy-MM-dd') : ''
}

// Compact pricing panel shown below the step on smaller screens (the side panel covers xl screens)
const PricingPanel =({ derivedTotals }: { derivedTotals: ReturnType<typeof calculateOrderTotals> }) => (
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
          <span className="text-muted-foreground">Extras</span>
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
  // Equal-width columns keep every connector the same length whatever the label width
  <ol className="grid" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
    {STEPS.map((step, index) => {
      const isPast = step.id < currentStep
      const isCurrent = step.id === currentStep
      const isReachable = step.id <= maxStepReached
      const isClickable = isReachable && !isCurrent
      return (
        <li key={step.id} className="relative flex flex-col items-center gap-1.5">
          {index < STEPS.length - 1 && (
            <span
              aria-hidden
              className={`absolute top-[17px] h-0.5 rounded-full transition-colors duration-300 ${step.id < maxStepReached ? 'bg-primary' : 'bg-border'}`}
              style={{ left: 'calc(50% + 24px)', width: 'calc(100% - 48px)' }}
            />
          )}
          <button
            type="button"
            disabled={!isClickable}
            onClick={() => onStepClick(step.id)}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`Step ${step.id + 1}: ${step.label}`}
            className={[
              'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200 disabled:cursor-default',
              isCurrent
                ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20'
                : isPast
                  ? 'border-primary bg-primary text-primary-foreground hover:opacity-75'
                  : isClickable
                    ? 'border-primary bg-background text-primary hover:bg-muted/50'
                    : 'border-border bg-background text-muted-foreground',
            ].join(' ')}
          >
            {isPast ? <RiCheckLine className="h-4 w-4" /> : <span className="text-xs font-bold">{step.id + 1}</span>}
          </button>
          <span
            onClick={() => isClickable && onStepClick(step.id)}
            className={[
              'hidden sm:block max-w-full truncate px-1 text-center text-xs font-medium',
              isCurrent
                ? 'font-semibold text-primary dark:text-sidebar-primary'
                : isPast
                  ? 'text-foreground cursor-pointer hover:text-primary'
                  : isClickable
                    ? 'text-primary cursor-pointer hover:opacity-80'
                    : 'text-muted-foreground',
            ].join(' ')}
          >
            {step.label}
          </span>
        </li>
      )
    })}
  </ol>
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
  frame: { isOld: false, isReference: false, selectionId: '', barcode: '', model: '', color: '', size: '', frameId: '', frameNo: '', total: 0 },
  lens: { isOld: false, isReference: false, selectionId: '', lensType: '', color: '', size: '', lensId: '', total: 0 },
  expenses: [],
  totals: { discountType: 'AMOUNT', discount: 0, advancedPayment: 0, fullPaymentDate: '', invoiceNumber: '' },
  remarks: '',
  saleLocation: undefined,
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
    sphere: Number(rx.eye_prescription?.right_eye?.sphere ?? 0),
    cylinder: Number(rx.eye_prescription?.right_eye?.cylinder ?? 0),
    axis: Number(rx.eye_prescription?.right_eye?.axis ?? 0),
    add: Number(rx.eye_prescription?.right_eye?.add ?? 0),
    pd: Number(rx.eye_prescription?.right_eye?.pupillary_distance ?? 0),
  },
  leftEye: {
    sphere: Number(rx.eye_prescription?.left_eye?.sphere ?? 0),
    cylinder: Number(rx.eye_prescription?.left_eye?.cylinder ?? 0),
    axis: Number(rx.eye_prescription?.left_eye?.axis ?? 0),
    add: Number(rx.eye_prescription?.left_eye?.add ?? 0),
    pd: Number(rx.eye_prescription?.left_eye?.pupillary_distance ?? 0),
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
  frameNo: '',
  total: product.selling_price,
})

// ─── Draft → form mapper ──────────────────────────────────────────────────────

// Categories sold as frames; everything else on a "product" line is an accessory
const FRAME_CATEGORIES = ['frames', 'sunglasses']

/**
 * The frame line of a saved order. Variant and manual frames are saved as
 * "frame" lines. A catalog frame is a "product" line, like an accessory, so it
 * is told apart by its category, or, for a product no longer in the catalog,
 * by the frame price saved with the order.
 */
const findFrameLine = (order: SalesOrder, products: Product[]) => {
  const frameLine = order.items.find((i) => i.line_type === 'frame')
  if (frameLine) return frameLine
  const productLines = order.items.filter((i) => i.line_type === 'product')
  const byCategory = productLines.find((i) =>
    FRAME_CATEGORIES.includes(products.find((p) => p.product_id === i.product_id)?.category?.toLowerCase() ?? ''))
  if (byCategory) return byCategory
  const frameTotal = Number((order.measurements as Record<string, any> | undefined)?.frame_total || 0)
  return frameTotal > 0
    ? productLines.find((i) => i.unit_price === frameTotal && !products.some((p) => p.product_id === i.product_id))
    : undefined
}

/** Accessories sold with a saved order: its "product" lines other than the frame */
const accessoryLinesOf = (order: SalesOrder, frameLine: SalesOrderItem | undefined) =>
  order.items
    .filter((i) => i.line_type === 'product' && i !== frameLine)
    .map((i) => ({ productId: i.product_id, productName: i.product_name || i.product_id, sku: i.sku || '', qty: i.quantity, unitPrice: i.unit_price }))

const mapDraftToFormValues = (
  order: SalesOrder,
  patient: Patient | null,
  prescription: import('@/types/prescription.types').Prescription | null,
  products: Product[],
): SalesOrderIntakeValues => {
  const frameItem = findFrameLine(order, products)
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
      isOld:        ['HISTORICAL_FRAME', 'REF_FRAME'].includes(frameItem.product_id),
      isReference:  frameItem.product_id === 'REF_FRAME',
      selectionId:  ['HISTORICAL_FRAME', 'REF_FRAME'].includes(frameItem.product_id) ? '' : (frameItem.frame_variant_id || frameItem.product_id),
      barcode:      frameItem.sku || '',
      model:        frameItem.product_name || '',
      color:        '',
      size:         '',
      // For a manual frame this field is the brand, which the saved name already includes
      frameId:      ['HISTORICAL_FRAME', 'REF_FRAME'].includes(frameItem.product_id) ? '' : (frameItem.sku || ''),
      frameNo:      frameItem.sku || '',
      total:        frameItem.unit_price,
    } : defaultValues.frame,
    lens: lensItem ? {
      isOld:        ['HISTORICAL_LENS', 'REF_LENS'].includes(lensItem.product_id),
      isReference:  lensItem.product_id === 'REF_LENS',
      selectionId:  ['HISTORICAL_LENS', 'REF_LENS'].includes(lensItem.product_id) ? '' : (lensItem.master_data_id || lensItem.product_id),
      lensType:     lensItem.product_name || '',
      color:        '',
      size:         '',
      lensId:       lensItem.sku === 'MANUAL' ? '' : (lensItem.sku || ''),
      total:        lensItem.unit_price,
    } : defaultValues.lens,
    expenses: expItems.map((e) => ({
      expenseTypeId:   e.master_data_id || e.product_id || '',
      expenseTypeName: e.product_name || '',
      qty:             e.quantity,
      unitCost:        e.unit_price,
      discount:        e.discount || 0,
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
    saleLocation: (order.sale_location as 'institute' | 'clinic' | undefined) ?? undefined,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

const SalesOrderIntakeForm = ({ draftOrderId, reorderFromId, initialPatient }: { draftOrderId?: string; reorderFromId?: string; initialPatient?: Patient }) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [maxStepReached, setMaxStepReached] = useState(0)
  const [savedOrderNumber, setSavedOrderNumber] = useState('')
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [phoneMatches, setPhoneMatches] = useState<Patient[]>([])
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

  // Products given away with the order: saved as complimentary lines for stock, left off the invoice
  const [freeItemIds, setFreeItemIds] = useState<string[]>([])
  const [suggestedCase, setSuggestedCase] = useState<ComplimentaryProductSuggestion | null>(null)
  const [frameSource, setFrameSource] = useState<'catalog' | 'variant'>('variant')
  const [selectedFrameVariant, setSelectedFrameVariant] = useState<FrameVariant | null>(null)
  const [generalItems, setGeneralItems] = useState<Array<{ productId: string; productName: string; sku: string; qty: number; unitPrice: number }>>([])
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
  })
  // Company details printed on the invoice preview
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
  })
  // Payment due date follows the collection date unless the user unticks this
  const [paymentDueSameAsDelivery, setPaymentDueSameAsDelivery] = useState(true)
  // null = follow the step: the order summary while building the order, the invoice on Review & Pay
  const [rightPanel, setRightPanel] = useState<'preview' | 'summary' | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [showAdvanceReceipt, setShowAdvanceReceipt] = useState(false)

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
  const saleLocation = useWatch({ control, name: 'saleLocation' })
  const remarks = useWatch({ control, name: 'remarks' })

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

  // Unfinished orders are saved as drafts (status "draft", found under Sales Orders →
  // Drafts). Earlier versions also kept a browser-only copy, with patient details;
  // clear it so it doesn't linger.
  useEffect(() => {
    try { localStorage.removeItem('so_intake_local_draft') } catch { /* storage blocked */ }
  }, [])

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
  // Explicit "find existing patient" search on the Patient step
  const [patientQuery, setPatientQuery] = useState('')
  const { data: patientQueryResults, isFetching: isSearchingPatients } = usePatientSearch(patientQuery)
  const { data: patientPrescriptions } = usePrescriptionFetch(patient.existingId || undefined)
  const { isScannerOpen: barcodeScannerOpen, openScanner, closeScanner, scanBarcode, isScanningProduct } = useBarcodeScanner()
  const { fields: expenseFields, append, remove } = useFieldArray({ control, name: 'expenses' })

  // Derived options
  const generalInventoryOptions = useMemo<LookupOption[]>(() =>
    (productData?.data || [])
      .filter((p) => !['frames', 'sunglasses'].includes(p.category.toLowerCase()) && p.current_stock > 0 && p.is_active)
      .map((p) => ({ value: p.product_id, label: p.name, subtitle: `${p.sku} · ${formatCurrency(p.selling_price)}` }))
  , [productData])

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
    // A selection that isn't a catalog product is a frame variant: don't swap it for a name match
    if (frame.selectionId) return null
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
      expenses: [
        ...(expenses || []).map((item) => ({ qty: Number(item.qty || 0), unitCost: Number(item.unitCost || 0), discount: Number(item.discount || 0) })),
        ...generalItems.map((g) => ({ qty: g.qty, unitCost: g.unitPrice, discount: 0 })),
      ],
      discount: Number(totals.discount || 0),
      discountType: totals.discountType,
      advancedPayment: Number(totals.advancedPayment || 0),
      isOldOrder: salesOrder.isOld,
    })
  , [expenses, frame.total, generalItems, lens.total, salesOrder.isOld, totals.advancedPayment, totals.discount, totals.discountType])

  const testedByName = testedByOptions.find((u) => u.value === salesOrder.testedBy)?.label

  // One view of the order for the summary panel, the invoice preview and the review step
  const invoicePreview = useMemo<InvoicePreviewData>(() => {
    const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' · ')
    const lines: InvoicePreviewLine[] = []
    if (frame.model || frame.total > 0 || frame.isReference) {
      lines.push({
        key: 'frame', type: 'Frame', qty: 1, discount: 0,
        name: frame.isReference ? `${frame.model || 'Frame'} (patient's own)` : (frame.model || 'Frame'),
        detail: join(frame.color, frame.size, frame.barcode || frame.frameId),
        unitPrice: Number(frame.total || 0), total: Number(frame.total || 0),
      })
    }
    if (lens.lensType || lens.total > 0) {
      lines.push({
        key: 'lens', type: 'Lens', qty: 1, discount: 0,
        name: lens.lensType || 'Lens',
        detail: join(lens.color, lens.size, lens.lensId),
        unitPrice: Number(lens.total || 0), total: Number(lens.total || 0),
      })
    }
    generalItems.forEach((g) => lines.push({
      key: `acc-${g.productId}`, type: 'Product', name: g.productName, detail: g.sku,
      qty: g.qty, unitPrice: g.unitPrice, discount: 0, total: roundCurrency(g.unitPrice * g.qty),
    }))
    ;(expenses || []).forEach((e, i) => {
      const name = e.expenseTypeName || expenseMasterData?.data.find((x) => x.id === e.expenseTypeId)?.name
      if (!name && !e.unitCost) return
      lines.push({
        key: `chg-${i}`, type: 'Service', name: name || 'Charge',
        qty: Number(e.qty || 0), unitPrice: Number(e.unitCost || 0), discount: Number(e.discount || 0),
        total: calculateLineTotal({ qty: Number(e.qty || 0), unitCost: Number(e.unitCost || 0), discount: Number(e.discount || 0) }),
      })
    })
    if (!salesOrder.isOld) {
      freeItemIds.forEach((id) => {
        const product = productData?.data.find((p) => p.product_id === id)
        if (product) lines.push({ key: `free-${id}`, type: 'Free', name: product.name, detail: product.sku, qty: 1, unitPrice: 0, discount: 0, total: 0 })
      })
    }
    return {
      invoiceNumber: savedInvoice?.invoice_number,
      salesOrderNumber: savedOrderNumber || undefined,
      issueDate: salesOrder.orderDate || today,
      dueDate: salesOrder.dateOfFullPayment || salesOrder.deliveryDate,
      billTo: {
        name: patient.newData.fullName,
        phone: patient.newData.phone,
        email: patient.newData.email || undefined,
        address: patient.newData.address || undefined,
      },
      lines,
      subtotal: derivedTotals.subtotalBeforeDiscount,
      discount: derivedTotals.discountTotal,
      total: derivedTotals.subtotal,
      paid: salesOrder.isOld ? 0 : derivedTotals.advancedPayment,
      balance: derivedTotals.balancePayment,
      notes: remarks?.trim() || undefined,
      testedBy: testedByName,
      prescriptionRef: prescription.existingId || undefined,
      isHistorical: salesOrder.isOld,
    }
  }, [derivedTotals, expenseMasterData, expenses, frame, freeItemIds, generalItems, lens, patient.newData, prescription.existingId, productData, remarks, salesOrder, savedInvoice, savedOrderNumber, testedByName])

  const summaryExtras = useMemo<OrderSummaryExtras>(() => {
    const eye = (e: { sphere: number; cylinder: number; axis: number; add: number }) =>
      ({ sphere: Number(e.sphere || 0), cylinder: Number(e.cylinder || 0), axis: Number(e.axis || 0), add: Number(e.add || 0) })
    const rx = prescription.newData
    return {
      patientMeta: [patient.newData.age ? `${patient.newData.age} yrs` : '', patient.newData.gender || ''].filter(Boolean).join(', ') || undefined,
      isExistingPatient: !!patient.existingId,
      prescription: maxStepReached < 1 && !prescription.existingId
        ? null
        : { label: prescription.existingId ? 'Previous prescription' : 'New measurements', od: eye(rx.rightEye), os: eye(rx.leftEye) },
      orderDate: salesOrder.orderDate,
      readyDate: salesOrder.deliveryDate,
      soldAt: saleLocation === 'institute' ? 'Institute' : saleLocation === 'clinic' ? 'Clinic' : undefined,
    }
  }, [maxStepReached, patient, prescription, saleLocation, salesOrder.deliveryDate, salesOrder.orderDate])

  const handleDownloadInvoicePdf = async () => {
    if (!savedInvoice) return
    setIsDownloadingPdf(true)
    try {
      const blob = await invoicesApi.downloadPDF(savedInvoice.invoice_id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${savedInvoice.invoice_number}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download the invoice PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

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
    if (paymentDueSameAsDelivery && salesOrder.deliveryDate) {
      setValue('salesOrder.dateOfFullPayment', salesOrder.deliveryDate, { shouldDirty: false, shouldValidate: false })
    }
  }, [paymentDueSameAsDelivery, salesOrder.deliveryDate, setValue])

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

  // Pre-fill patient and skip to step 1 when navigated from the Patients page
  useEffect(() => {
    if (!initialPatient || draftOrderId || reorderFromId) return
    setValue('patient.existingId', initialPatient.patient_id, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.fullName', initialPatient.name, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.phone', initialPatient.phone, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.email', initialPatient.email || '', { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.age', initialPatient.age, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.gender', initialPatient.gender, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.address', formatAddress(initialPatient), { shouldDirty: true, shouldValidate: true })
    setCurrentStep(1)
    setMaxStepReached(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount — initialPatient is stable after navigation

  useEffect(() => {
    if (!frame.total || frame.total <= 0) return
    let cancelled = false
    basicDataApi.suggestComplimentary(frame.total).then((item) => {
      if (cancelled) return
      setSuggestedCase(item)
      // A new order starts with the suggested item; a draft keeps what was saved
      if (item && !draftOrderId) setFreeItemIds((prev) => (prev.length ? prev : [item.product_id]))
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.total])

  useEffect(() => {
    // Picking a frame fills everything (applyFrameSelection). This only fills gaps, e.g. a
    // reopened order, and leaves the price alone: it's what the patient was quoted.
    if (frame.selectionId && resolvedFrame) {
      const fill = (name: 'frame.model' | 'frame.color' | 'frame.size' | 'frame.frameId' | 'frame.barcode', value: string) => {
        if (!getValues(name)) setValue(name, value, { shouldDirty: false, shouldValidate: false })
      }
      fill('frame.model', resolvedFrame.name)
      fill('frame.color', resolvedFrame.specifications?.color ? String(resolvedFrame.specifications.color) : resolvedFrame.brand || '')
      fill('frame.size', resolvedFrame.specifications?.size ? String(resolvedFrame.specifications.size) : resolvedFrame.unit_of_measure || '')
      fill('frame.frameId', resolvedFrame.sku)
      fill('frame.barcode', resolvedFrame.barcode || resolvedFrame.sku)
    }
  }, [frame.selectionId, getValues, resolvedFrame, setValue])

  useEffect(() => {
    // Same as the frame: fill gaps, keep the quoted price (applyLensSelection prices a new pick)
    if (lens.selectionId && resolvedLens) {
      const fill = (name: 'lens.lensType' | 'lens.color' | 'lens.size' | 'lens.lensId', value: string) => {
        if (!getValues(name)) setValue(name, value, { shouldDirty: false, shouldValidate: false })
      }
      fill('lens.lensType', resolvedLens.lens_type)
      fill('lens.color', resolvedLens.color)
      fill('lens.size', resolvedLens.size)
      fill('lens.lensId', resolvedLens.lens_code)
    }
  }, [getValues, lens.selectionId, resolvedLens, setValue])

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
  // Products are needed too: they tell a catalog frame apart from an accessory
  const draftLoaded = !!draftOrder && (draftOrder.prescription_id ? !!draftPrescription : true) && !!draftPatient && !!productData
  useEffect(() => {
    if (!draftLoaded) return
    const products = productData?.data ?? []
    const mapped = mapDraftToFormValues(draftOrder, draftPatient ?? null, draftPrescription ?? null, products)
    reset(mapped, { keepDirty: false })
    const frameLine = findFrameLine(draftOrder, products)
    if (frameLine) setFrameSource(frameLine.frame_variant_id ? 'variant' : 'catalog')
    if (frameLine?.frame_variant_id) {
      frameVariantsApi.getById(frameLine.frame_variant_id)
        .then((variant) => {
          setSelectedFrameVariant(variant)
          // The order line has no colour or size; the price stays as sold
          setValue('frame.color', variant.color, { shouldDirty: false })
          setValue('frame.size', String(variant.eye_size), { shouldDirty: false })
          if (variant.supplier_frame_no) setValue('frame.frameNo', variant.supplier_frame_no, { shouldDirty: false })
        })
        .catch(() => toast.error("Couldn't load this order's frame from stock. Its saved details are shown instead."))
    }
    setGeneralItems(accessoryLinesOf(draftOrder, frameLine))
    setFreeItemIds(draftOrder.items.filter((i) => i.line_type === 'complimentary').map((i) => i.product_id))
    // Every step already has the order's details, so any step can be opened directly
    setMaxStepReached(STEPS.length - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded])

  // Reorder pre-fill — load original order and copy patient + items into a fresh form
  const { data: reorderSource, isLoading: isLoadingReorder } = useQuery({
    queryKey: ['sales-order-reorder-source', reorderFromId],
    queryFn: () => salesOrdersApi.getById(reorderFromId!),
    enabled: !!reorderFromId,
    staleTime: Infinity,
  })
  const { data: reorderPatient } = useQuery({
    queryKey: ['patient', reorderSource?.patient_id],
    queryFn: () => patientsApi.getById(reorderSource!.patient_id),
    enabled: !!reorderSource?.patient_id,
    staleTime: Infinity,
  })
  const reorderLoaded = !!reorderSource && !!reorderPatient && !!productData
  useEffect(() => {
    if (!reorderLoaded) return
    const src = reorderSource
    const pat = reorderPatient!
    const frameItem = findFrameLine(src, productData?.data ?? [])
    const lensItem  = src.items.find((i) => i.line_type === 'lens')
    const expItems  = src.items.filter((i) => i.line_type === 'expense')
    reset({
      ...defaultValues,
      patient: {
        existingId: pat.patient_id,
        newData: { fullName: pat.name, email: pat.email || '', phone: pat.phone, age: pat.age, gender: pat.gender as any, address: formatAddress(pat) },
      },
      frame: frameItem ? {
        isOld:       ['HISTORICAL_FRAME', 'REF_FRAME'].includes(frameItem.product_id),
        isReference: frameItem.product_id === 'REF_FRAME',
        selectionId: '', barcode: frameItem.sku || '', model: frameItem.product_name || '',
        color: '', size: '',
        frameId: ['HISTORICAL_FRAME', 'REF_FRAME'].includes(frameItem.product_id) ? '' : (frameItem.sku || ''),
        frameNo: frameItem.sku || '', total: frameItem.unit_price,
      } : defaultValues.frame,
      lens: lensItem ? {
        isOld:       ['HISTORICAL_LENS', 'REF_LENS'].includes(lensItem.product_id),
        isReference: lensItem.product_id === 'REF_LENS',
        selectionId: lensItem.master_data_id || '', lensType: lensItem.product_name || '',
        color: '', size: '', lensId: lensItem.sku || '', total: lensItem.unit_price,
      } : defaultValues.lens,
      expenses: expItems.map((e) => ({
        expenseTypeId: e.master_data_id || e.product_id || '',
        expenseTypeName: e.product_name || '',
        qty: e.quantity, unitCost: e.unit_price, discount: e.discount || 0, total: e.total,
      })),
      salesOrder: { ...defaultValues.salesOrder, isOld: false },
    }, { keepDirty: false })
    setGeneralItems(accessoryLinesOf(src, frameItem))
    // Try to restore the frame variant if it was one
    if (frameItem?.frame_variant_id) {
      setFrameSource('variant')
      frameVariantsApi.getById(frameItem.frame_variant_id).then(setSelectedFrameVariant).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderLoaded])

  // Mutations
  const createPatientMutation = useMutation({ mutationFn: (p: Parameters<typeof patientsApi.create>[0]) => patientsApi.create(p) })
  const createPrescriptionMutation = useMutation({ mutationFn: (p: Parameters<typeof prescriptionsApi.create>[0]) => prescriptionsApi.create(p) })
  const createSalesOrderMutation = useMutation({ mutationFn: (p: Parameters<typeof salesOrdersApi.create>[0]) => salesOrdersApi.create(p) })
  const updateSalesOrderMutation = useMutation({ mutationFn: ({ id, data }: { id: string; data: Parameters<typeof salesOrdersApi.update>[1] }) => salesOrdersApi.update(id, data) })
  const generateInvoiceMutation = useMutation({ mutationFn: (orderId: string) => salesOrdersApi.generateInvoice(orderId) })

  // Handlers
  const applyFrameSelection = (product: Product) => setValue('frame', { isOld: false, isReference: false, ...mapProductToFrame(product) }, { shouldDirty: true, shouldValidate: true })

  const applyFrameVariantSelection = (variant: FrameVariant | null) => {
    setSelectedFrameVariant(variant)
    if (variant) {
      setValue('frame', {
        isOld: false,
        isReference: false,
        selectionId: variant.variant_id,
        barcode: variant.barcode || variant.sku,
        model: `${variant.frame_master_ref.brand} ${variant.frame_master_ref.model_code}`,
        color: variant.color,
        size: String(variant.eye_size),
        frameId: variant.sku,
        frameNo: variant.supplier_frame_no || '',
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
    setValue('patient.existingId', '', { shouldDirty: true, shouldValidate: false })
    setValue('patient.newData', defaultValues.patient.newData, { shouldDirty: true, shouldValidate: false })
    // The auto-loaded prescription belonged to the previous patient
    setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: false })
    setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false })
  }

  const addExpenseRow = () => append({ expenseTypeId: '', expenseTypeName: '', qty: 1, unitCost: 0, discount: 0, total: 0 })

  // Quick-add a common charge; adding one that's already listed bumps its quantity
  const quickAddCharge = (type: { id: string; name: string; default_cost: number }) => {
    const index = (getValues('expenses') || []).findIndex((e) => e.expenseTypeId === type.id)
    if (index >= 0) {
      updateExpenseRow(index, 'qty', Number(getValues(`expenses.${index}.qty`) || 0) + 1)
      return
    }
    append({ expenseTypeId: type.id, expenseTypeName: type.name, qty: 1, unitCost: type.default_cost, discount: 0, total: type.default_cost })
  }

  const addFreeItem = (id: string) => { if (id) setFreeItemIds((prev) => (prev.includes(id) ? prev : [...prev, id])) }
  const removeFreeItem = (id: string) => setFreeItemIds((prev) => prev.filter((x) => x !== id))
  // Free items as order lines; ids that no longer match a product are dropped
  const freeItemLines = (): SalesOrderItem[] => freeItemIds.flatMap((id) => {
    const p = productData?.data.find((x) => x.product_id === id)
    return p ? [{ product_id: p.product_id, product_name: p.name, sku: p.sku, quantity: 1, unit_price: 0, total: 0, master_data_id: p.product_id, line_type: 'complimentary' as const, track_stock: true }] : []
  })

  const changeAccessoryQty = (index: number, delta: number) =>
    setGeneralItems((prev) => prev.map((item, i) => (i === index ? { ...item, qty: Math.max(1, item.qty + delta) } : item)))

  // "Ready in" shortcuts count from the order date
  const setDeliveryInDays = (days: number) =>
    setValue('salesOrder.deliveryDate', addDaysTo(getValues('salesOrder.orderDate') || today, days), { shouldDirty: true, shouldValidate: true })

  // Inline new expense type dialog
  const [newExpenseDialogOpen, setNewExpenseDialogOpen] = useState(false)
  const [newExpenseName, setNewExpenseName] = useState('')
  const [newExpenseCost, setNewExpenseCost] = useState(0)
  const createExpenseTypeMutation = useMutation({
    mutationFn: (data: { name: string; default_cost: number }) =>
      basicDataApi.createOtherExpense({ ...data, is_active: true }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['basic-data', 'other-expenses'] })
      setNewExpenseDialogOpen(false)
      setNewExpenseName('')
      setNewExpenseCost(0)
      // Add a row pre-filled with the newly created type
      append({ expenseTypeId: created.id, expenseTypeName: created.name, qty: 1, unitCost: created.default_cost, discount: 0, total: created.default_cost })
      toast.success(`Expense type "${created.name}" created`)
    },
    onError: () => toast.error('Failed to create expense type'),
  })

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
            const result = await queryClient.fetchQuery({
              queryKey: ['patients', 'search', searchTerm],
              queryFn: () => patientsApi.getAll({ page: 1, page_size: 25, search: searchTerm }),
              staleTime: 10_000,
            })
            const results = result.data || []
            const phoneMatchList = results.filter(item => phoneDigits(safeText(item?.phone)) === phoneDigits(phone))
            const nameMatch = !phoneMatchList.length && name
              ? results.find(item => normalizeText(safeText(item?.name)).includes(normalizeText(name))) || null
              : null
            const matches = phoneMatchList.length > 0 ? phoneMatchList : (nameMatch ? [nameMatch] : [])
            if (matches.length > 0) {
              setPhoneMatches(matches)
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

  const handleReset = () => {
    reset(defaultValues); setSavedOrderNumber(''); setSavedInvoice(null); setCurrentStep(0); setMaxStepReached(0)
    // These live outside the form, so reset() doesn't clear them
    setGeneralItems([]); setFreeItemIds([]); setSuggestedCase(null); setSelectedFrameVariant(null); setRightPanel(null)
  }

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
    } else if (values.frame.isOld && (values.frame.model || values.frame.frameId || values.frame.frameNo)) {
      const frameName = [values.frame.frameId, values.frame.model].filter(Boolean).join(' ').trim() || values.frame.frameNo
      const frameProductId = values.frame.isReference ? 'REF_FRAME' : 'HISTORICAL_FRAME'
      const frameTotal = values.frame.isReference ? 0 : Number(values.frame.total || 0)
      draftItems.push({ product_id: frameProductId, product_name: frameName, sku: values.frame.frameNo || values.frame.barcode || values.frame.frameId || 'MANUAL', quantity: 1, unit_price: frameTotal, total: frameTotal, line_type: 'frame', track_stock: false })
    }
    if (resolvedLens) {
      draftItems.push({ product_id: resolvedLens.id, product_name: values.lens.lensType || resolvedLens.lens_type, sku: values.lens.lensId || resolvedLens.lens_code, quantity: 1, unit_price: Number(values.lens.total || resolvedLens.price), total: Number(values.lens.total || resolvedLens.price), master_data_id: resolvedLens.id, line_type: 'lens', track_stock: false })
    } else if (values.lens.isOld && values.lens.lensType) {
      const lensProductId = values.lens.isReference ? 'REF_LENS' : 'HISTORICAL_LENS'
      const lensTotal = values.lens.isReference ? 0 : Number(values.lens.total || 0)
      draftItems.push({ product_id: lensProductId, product_name: values.lens.lensType, sku: values.lens.lensId || 'MANUAL', quantity: 1, unit_price: lensTotal, total: lensTotal, line_type: 'lens', track_stock: false })
    }
    values.expenses.forEach((expense) => {
      if (!expense.expenseTypeId && !expense.expenseTypeName) return
      if (Number(expense.qty || 0) <= 0) return
      const sel = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
      draftItems.push({ product_id: expense.expenseTypeId || 'EXPENSE', product_name: expense.expenseTypeName || sel?.name || 'Expense', sku: expense.expenseTypeId || 'EXPENSE', quantity: Number(expense.qty), unit_price: Number(expense.unitCost || 0), discount: Number(expense.discount || 0), total: calculateLineTotal({ qty: Number(expense.qty), unitCost: Number(expense.unitCost || 0), discount: Number(expense.discount || 0) }), master_data_id: sel?.id || expense.expenseTypeId || undefined, line_type: 'expense', track_stock: false })
    })
    generalItems.filter((g) => g.qty > 0).forEach((g) => {
      draftItems.push({ product_id: g.productId, product_name: g.productName, sku: g.sku, quantity: g.qty, unit_price: g.unitPrice, total: g.unitPrice * g.qty, master_data_id: g.productId, line_type: 'product', track_stock: true })
    })
    draftItems.push(...freeItemLines())

    if (draftItems.length === 0) {
      // The server needs at least one item on an order. Stay here and say so,
      // rather than quietly discarding what was typed.
      toast.error('Pick a frame, lens or product first. A draft needs at least one item.')
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
        discount_amount: derivedTotals.discountTotal,
        measurements: { order_date: values.salesOrder.orderDate, frame_total: values.frame.total, lens_total: values.lens.total },
        sale_location: values.saleLocation || undefined,
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
      if (!values.frame.isOld && !frameItem && !(frameSource === 'variant' && selectedFrameVariant)) { toast.error('Frame selection is required'); return }
      const lensItem = resolvedLens
      // Lens is optional — frame only = half order, frame + lens = full order
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
      } else if (values.frame.isOld && (values.frame.model || values.frame.frameId || values.frame.frameNo)) {
        const frameName = [values.frame.frameId, values.frame.model].filter(Boolean).join(' ').trim() || values.frame.frameNo
        const frameProductId = values.frame.isReference ? 'REF_FRAME' : 'HISTORICAL_FRAME'
        const frameTotal = values.frame.isReference ? 0 : Number(values.frame.total || 0)
        itemPayload.push({ product_id: frameProductId, product_name: frameName, sku: values.frame.frameNo || values.frame.barcode || values.frame.frameId || 'MANUAL', quantity: 1, unit_price: frameTotal, total: frameTotal, line_type: 'frame' as const, track_stock: false })
      }
      if (lensItem) {
        itemPayload.push({ product_id: lensItem.id, product_name: values.lens.lensType || lensItem.lens_type, sku: values.lens.lensId || lensItem.lens_code, quantity: 1, unit_price: Number(values.lens.total || lensItem.price), total: Number(values.lens.total || lensItem.price), master_data_id: lensItem.id, line_type: 'lens' as const, track_stock: false })
      } else if (values.lens.isOld && values.lens.lensType) {
        const lensProductId = values.lens.isReference ? 'REF_LENS' : 'HISTORICAL_LENS'
        const lensTotal = values.lens.isReference ? 0 : Number(values.lens.total || 0)
        itemPayload.push({ product_id: lensProductId, product_name: values.lens.lensType, sku: values.lens.lensId || 'MANUAL', quantity: 1, unit_price: lensTotal, total: lensTotal, line_type: 'lens' as const, track_stock: false })
      }
      itemPayload.push(...(values.expenses || []).filter((expense) => Number(expense.qty || 0) > 0).map((expense) => {
        const sel = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
        return { product_id: expense.expenseTypeId || 'EXPENSE', product_name: expense.expenseTypeName || sel?.name || 'Expense', sku: expense.expenseTypeId || 'EXPENSE', quantity: Number(expense.qty || 0), unit_price: Number(expense.unitCost || 0), discount: Number(expense.discount || 0), total: calculateLineTotal({ qty: Number(expense.qty || 0), unitCost: Number(expense.unitCost || 0), discount: Number(expense.discount || 0) }), master_data_id: sel?.id || expense.expenseTypeId || undefined, line_type: 'expense' as const, track_stock: false }
      }))

      generalItems.filter((g) => g.qty > 0).forEach((g) => {
        itemPayload.push({ product_id: g.productId, product_name: g.productName, sku: g.sku, quantity: g.qty, unit_price: g.unitPrice, total: g.unitPrice * g.qty, master_data_id: g.productId, line_type: 'product' as const, track_stock: true })
      })

      if (!values.salesOrder.isOld) itemPayload.push(...freeItemLines())

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
        discount_amount: derivedTotals.discountTotal,
        measurements: { order_date: values.salesOrder.orderDate, order_type: isFullOrder ? 'FULL_ORDER' : 'PARTIAL_ORDER', frame_total: values.frame.total, lens_total: values.lens.total, other_expenses_total: derivedTotals.expenseTotal, discount: derivedTotals.discountTotal, advance_payment: values.totals.advancedPayment },
        sale_location: values.saleLocation || undefined,
        status: 'created' as const,
        items: itemPayload,
      }

      // A draft becomes a created order; an order already in progress keeps its status
      // (the server only allows moving forward, so "created" would be rejected)
      const savedOrder = draftOrderId
        ? await updateSalesOrderMutation.mutateAsync({ id: draftOrderId, data: { ...orderPayload, status: isEditingOrder ? undefined : 'created' } })
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
          queryClient.invalidateQueries({ queryKey: ['patients'] })
        } catch {
          // ignore rollback failures; original error is the one we report
        }
      }
      toast.error(error?.response?.data?.detail || 'Failed to save sales order')
    }
  }

  if (isLoadingProducts || (draftOrderId && isLoadingDraft) || (reorderFromId && isLoadingReorder)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-border bg-card">
        <Loading text={isLoadingDraft ? 'Loading draft order...' : isLoadingReorder ? 'Loading order for reorder...' : 'Loading sales order masters...'} />
      </div>
    )
  }

  // Reopened an order that's past draft, rather than finishing a draft
  const isEditingOrder = !!draftOrder && draftOrder.status !== 'draft'
  const isSaving = createPatientMutation.isPending || createPrescriptionMutation.isPending || createSalesOrderMutation.isPending || updateSalesOrderMutation.isPending || generateInvoiceMutation.isPending
  const showPricingPanel = currentStep >= 2 && currentStep <= 5
  // From Extras on, the printable invoice preview is available beside (or above) the form
  const showInvoicePreview = currentStep >= 4
  const goToStep = (step: number) =>
    step <= maxStepReached && step !== currentStep && !savedOrderNumber ? () => setCurrentStep(step) : undefined

  // Problems that would stop the order saving, each with the step that fixes it
  const reviewIssues = [
    !patient.newData.fullName || !patient.newData.phone ? { message: 'Patient name or phone is missing', step: 0 } : null,
    !salesOrder.isOld && !frame.isOld && !frame.selectionId && !selectedFrameVariant ? { message: 'No frame selected', step: 2 } : null,
    !salesOrder.testedBy ? { message: 'Who tested the patient is not set', step: 5 } : null,
    !salesOrder.isOld && derivedTotals.advancedPayment > derivedTotals.subtotal ? { message: 'Paid now is more than the total due', step: 6 } : null,
  ].filter(Boolean) as Array<{ message: string; step: number }>

  const activeRightPanel = rightPanel ?? (currentStep === STEPS.length - 1 ? 'preview' : 'summary')

  // Extras step — the same split the step shows: accessories, services, free items
  const chargesTotal = roundCurrency((expenses || []).reduce((sum, e) =>
    sum + calculateLineTotal({ qty: Number(e.qty || 0), unitCost: Number(e.unitCost || 0), discount: Number(e.discount || 0) }), 0))
  const accessoriesTotal = roundCurrency(generalItems.reduce((sum, g) => sum + g.unitPrice * g.qty, 0))
  const freeProducts = freeItemIds.flatMap((id) => productData?.data.find((p) => p.product_id === id) ?? [])
  const freeItemOptions: LookupOption[] = (productData?.data || [])
    .filter((p) => p.is_active && !freeItemIds.includes(p.product_id))
    .map((p) => ({ value: p.product_id, label: p.name, subtitle: [p.sku, p.category].filter(Boolean).join(' · ') }))
  const showFreeSuggestion = !!suggestedCase && !freeItemIds.includes(suggestedCase.product_id)

  // Order Details step — how far off collection is
  const daysBetween = differenceInCalendarDays(parseISO(salesOrder.deliveryDate || ''), parseISO(salesOrder.orderDate || ''))
  const readyInDays = Number.isNaN(daysBetween) ? null : daysBetween

  return (
    <>
      <QRScanner isOpen={barcodeScannerOpen} onScan={handleBarcodeScan} onClose={closeScanner} />

      <SaveRecordDialog
        isOpen={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        recordName="sales order"
        isCreating={!isEditingOrder}
        confirmLabel={isEditingOrder ? 'Save Changes' : 'Create Order'}
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
            <AlertDialogTitle>
              {phoneMatches.length === 1 ? 'Existing patient found' : `${phoneMatches.length} patients share this phone number`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {phoneMatches.length === 1
                  ? <p>A patient record already exists matching this information. Select one or proceed as a new patient.</p>
                  : <p>Multiple patients are registered under this phone number (e.g. household members). Select who this order is for, or proceed as a new patient.</p>
                }
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {phoneMatches.map((p) => (
                    <div key={p.patient_id} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground">{safeText(p.name)}</p>
                        <p className="text-muted-foreground">{safeText(p.phone)}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          handlePatientAction(p)
                          setShowDuplicateDialog(false)
                          setCurrentStep(1)
                        }}
                      >
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
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
              New Patient (same number)
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice preview for screens without the side column */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice preview</DialogTitle>
          </DialogHeader>
          <InvoicePreview data={invoicePreview} company={companyProfile} />
          <InvoicePreviewStatus data={invoicePreview} />
          {savedInvoice && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDownloadInvoicePdf} disabled={isDownloadingPdf}>
                <RiDownloadLine className="mr-1.5 h-4 w-4" />Download PDF
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {savedInvoice && (
        <AdvanceReceiptDialog
          open={showAdvanceReceipt}
          onOpenChange={setShowAdvanceReceipt}
          invoice={savedInvoice}
          orderNumber={savedOrderNumber || undefined}
          readyDate={salesOrder.deliveryDate || undefined}
        />
      )}

      <div className="mx-auto max-w-3xl space-y-4 xl:max-w-6xl">
        {/* Draft edit banner */}
        {draftOrderId && draftOrder && !savedOrderNumber && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
            <RiFileEditLine className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {isEditingOrder ? 'Editing order' : 'Editing draft'} — {draftOrder.order_number}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {isEditingOrder
                  ? 'Click any step above to change it, then save your changes on Review & Pay.'
                  : 'Click any step above to change it, then click "Create Order" to confirm it and generate an invoice.'}
              </p>
            </div>
          </div>
        )}

        <div className={`grid items-start gap-6 ${showInvoicePreview && activeRightPanel === 'preview' ? 'xl:grid-cols-[minmax(0,1fr)_440px]' : 'xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
        <div className="min-w-0 space-y-4">

        {/* Historical record toggle — only needed when keying in old paper orders */}
        <label
          className={`flex cursor-pointer select-none items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
            salesOrder.isOld
              ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <Checkbox
            checked={salesOrder.isOld}
            onCheckedChange={(checked) => {
              const next = !!checked
              setValue('salesOrder.isOld', next, { shouldDirty: true, shouldValidate: true })
              setValue('frame.isOld', next, { shouldDirty: true })
              setValue('frame.isReference', false, { shouldDirty: true })
              setValue('lens.isOld', next, { shouldDirty: true })
              setValue('lens.isReference', false, { shouldDirty: true })
            }}
          />
          <RiHistoryLine className={`h-4 w-4 shrink-0 ${salesOrder.isOld ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${salesOrder.isOld ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'}`}>
              Entering a past order from paper records
            </p>
            {salesOrder.isOld && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Frame and lens default to manual entry, no stock is deducted and no invoice is created.
              </p>
            )}
          </div>
        </label>

        {/* Progress stepper — compact on mobile, full circles on sm+ */}
        <div className="sm:hidden rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm font-semibold text-foreground">{STEPS[currentStep].label}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{STEPS[currentStep].hint}</p>
        </div>
        <Card className="hidden sm:block px-6 py-5">
          <StepIndicator currentStep={currentStep} maxStepReached={maxStepReached} onStepClick={setCurrentStep} />
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Step {currentStep + 1} of {STEPS.length}:</span> {STEPS[currentStep].hint}
          </p>
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
                    <CardTitle>Patient</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Search first — returning patients are already registered</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                {patientIsLinked ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex min-w-0 items-center gap-2">
                      <RiCheckLine className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-green-800 dark:text-green-200">{patient.newData.fullName}</p>
                        <p className="text-xs text-green-700 dark:text-green-300">Existing patient · {patient.newData.phone}</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={unlinkPatient}>Change patient</Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none text-foreground">Find existing patient</label>
                      <div className="relative">
                        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={patientQuery}
                          onChange={(e) => setPatientQuery(e.target.value)}
                          placeholder="Search by name or phone number…"
                          className="pl-9"
                          autoComplete="off"
                        />
                      </div>
                      {patientQuery.trim() && (
                        <div className="overflow-hidden rounded-lg border border-border">
                          {isSearchingPatients && !(patientQueryResults?.data || []).length ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
                          ) : (patientQueryResults?.data || []).length === 0 ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">No patient found — fill in the details below to register them.</p>
                          ) : (
                            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
                              {(patientQueryResults?.data || []).slice(0, 8).map((p) => (
                                <li key={p.patient_id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                                    onClick={() => { handlePatientAction(p); setPatientQuery('') }}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-foreground">{safeText(p.name)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {safeText(p.phone)}{p.age ? ` · ${p.age} yrs` : ''}
                                      </p>
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-primary">Select</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">or register a new patient</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Full Name" required error={errors.patient?.newData?.fullName?.message}>
                    <Input placeholder="Patient's full name" {...register('patient.newData.fullName')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Phone Number" required error={errors.patient?.newData?.phone?.message}>
                    <Input placeholder="e.g. 07X XXX XXXX" {...register('patient.newData.phone')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Email" error={errors.patient?.newData?.email?.message as string | undefined}>
                    <Input placeholder="Optional" {...register('patient.newData.email')} disabled={patientIsLinked} />
                  </Field>
                  <Field label="Age" error={errors.patient?.newData?.age?.message as string | undefined}>
                    <Input type="number" min={0} placeholder="Years" {...register('patient.newData.age')} disabled={patientIsLinked} />
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
                  <Input placeholder="Optional — street address or delivery note" {...register('patient.newData.address')} disabled={patientIsLinked} />
                </Field>
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
                    <p className="text-sm text-muted-foreground mt-0.5">OD is the right eye, OS the left eye. Leave a value at 0 if it wasn't measured.</p>
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
                  {/* Only offer a choice when the patient has history to choose from */}
                  {patient.existingId && (
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                      <TabsTrigger value="existing" className="gap-2">
                        <RiFileTextLine className="h-4 w-4" />
                        Use a previous prescription
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="gap-2">
                        <RiEyeLine className="h-4 w-4" />
                        Enter new measurements
                      </TabsTrigger>
                    </TabsList>
                  )}

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
                            <td className="pl-4 pr-2 py-3 align-top pt-3">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="default" className="bg-primary/20 text-primary border-primary/40 font-bold text-xs w-fit">OD</Badge>
                                <span className="text-[10px] text-muted-foreground">Right</span>
                              </div>
                            </td>
                            {/* Sphere — has PL/NPL shortcuts below the input */}
                            <td className="px-2 py-3 align-top">
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
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.cylinder')) || 0; setValue('prescription.newData.rightEye.cylinder', v + 0.25) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.cylinder')) || 0; setValue('prescription.newData.rightEye.cylinder', v - 0.25) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="1" placeholder="0" className="text-center h-9 font-medium tabular-nums min-w-[60px]"
                                {...register('prescription.newData.rightEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.axis')) || 0; setValue('prescription.newData.rightEye.axis', (v + 1) % 181) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.axis')) || 0; setValue('prescription.newData.rightEye.axis', v === 0 ? 180 : v - 1) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.add')) || 0; setValue('prescription.newData.rightEye.add', Math.min(v + 0.25, 4)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.add')) || 0; setValue('prescription.newData.rightEye.add', Math.max(v - 0.25, 0)) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.5" placeholder="0.0" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.rightEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.pd')) || 0; setValue('prescription.newData.rightEye.pd', Math.min(v + 0.5, 75)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.rightEye.pd')) || 0; setValue('prescription.newData.rightEye.pd', Math.max(v - 0.5, 50)) }
                                }} />
                            </td>
                          </tr>

                          {/* OS — Left Eye */}
                          <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                            <td className="pl-4 pr-2 py-3 align-top pt-3">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="secondary" className="bg-blue-100/60 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-bold text-xs w-fit">OS</Badge>
                                <span className="text-[10px] text-muted-foreground">Left</span>
                              </div>
                            </td>
                            {/* Sphere */}
                            <td className="px-2 py-3 align-top">
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
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.cylinder')) || 0; setValue('prescription.newData.leftEye.cylinder', v + 0.25) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.cylinder')) || 0; setValue('prescription.newData.leftEye.cylinder', v - 0.25) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="1" placeholder="0" className="text-center h-9 font-medium tabular-nums min-w-[60px]"
                                {...register('prescription.newData.leftEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.axis')) || 0; setValue('prescription.newData.leftEye.axis', (v + 1) % 181) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.axis')) || 0; setValue('prescription.newData.leftEye.axis', v === 0 ? 180 : v - 1) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.25" placeholder="0.00" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.add')) || 0; setValue('prescription.newData.leftEye.add', Math.min(v + 0.25, 4)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.add')) || 0; setValue('prescription.newData.leftEye.add', Math.max(v - 0.25, 0)) }
                                }} />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <Input type="number" step="0.5" placeholder="0.0" className="text-center h-9 font-medium tabular-nums min-w-[72px]"
                                {...register('prescription.newData.leftEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.pd')) || 0; setValue('prescription.newData.leftEye.pd', Math.min(v + 0.5, 75)) }
                                  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Number(getValues('prescription.newData.leftEye.pd')) || 0; setValue('prescription.newData.leftEye.pd', Math.max(v - 0.5, 50)) }
                                }} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Prescription helpers row */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        Use <kbd className="px-1 py-0.5 rounded border border-border/60 bg-muted text-[10px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded border border-border/60 bg-muted text-[10px] font-mono">↓</kbd> arrow keys to step values. <span className="hidden sm:inline">PL = Plano · NPL = No Perception of Light</span>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={prescriptionIsLinked}
                        onClick={() => {
                          const od = getValues('prescription.newData.rightEye')
                          setValue('prescription.newData.leftEye.sphere', od.sphere, { shouldDirty: true })
                          setValue('prescription.newData.leftEye.cylinder', od.cylinder, { shouldDirty: true })
                          setValue('prescription.newData.leftEye.axis', od.axis, { shouldDirty: true })
                          setValue('prescription.newData.leftEye.add', od.add, { shouldDirty: true })
                          setValue('prescription.newData.leftEye.pd', od.pd, { shouldDirty: true })
                          toast.success('OD values copied to OS')
                        }}
                        className="text-xs shrink-0"
                      >
                        Copy OD → OS
                      </Button>
                    </div>

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
                {frame.isOld ? (
                  /* Manual mode: historical (with price) or reference-only (no charge) */
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-600 dark:bg-amber-950/30">
                      <div className="flex items-center gap-2.5">
                        <RiHistoryLine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Entering the frame manually</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">For frames not in inventory — no stock is deducted</p>
                        </div>
                      </div>
                      <Button
                        type="button" variant="outline" size="sm" className="shrink-0"
                        onClick={() => {
                          setValue('frame.isOld', false, { shouldDirty: true })
                          setValue('frame.isReference', false, { shouldDirty: true })
                        }}
                      >
                        Search inventory instead
                      </Button>
                    </div>
                    {/* Reference-only sub-toggle */}
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer select-none transition-all ${
                        frame.isReference
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                          : 'border-border bg-muted/10 hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        const next = !frame.isReference
                        setValue('frame.isReference', next, { shouldDirty: true })
                        if (next) setValue('frame.total', 0, { shouldDirty: true })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <RiFileTextLine className={`h-3.5 w-3.5 ${frame.isReference ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                        <div>
                          <p className={`text-xs font-semibold ${frame.isReference ? 'text-blue-800 dark:text-blue-300' : 'text-foreground'}`}>
                            Reference only — no charge
                          </p>
                          <p className={`text-xs ${frame.isReference ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {frame.isReference ? 'Existing frame noted for records — $0, no stock change' : 'Toggle on if noting an existing frame the patient already has (e.g. lens-change visit)'}
                          </p>
                        </div>
                      </div>
                      <div
                        role="checkbox"
                        aria-checked={frame.isReference}
                        onClick={(e) => e.stopPropagation()}
                        className={`h-4 w-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                          frame.isReference ? 'bg-blue-500 border-blue-500' : 'border-blue-400/60 bg-transparent'
                        }`}
                      >
                        {frame.isReference && <RiCheckLine className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Field label="Frame No"><Input {...register('frame.frameNo')} placeholder="e.g. F-1024" /></Field>
                      <Field label="Brand"><Input {...register('frame.frameId')} placeholder="e.g. Ray-Ban" /></Field>
                      <Field label="Model / Name"><Input {...register('frame.model')} placeholder="e.g. Aviator" /></Field>
                      <Field label="Color"><Input {...register('frame.color')} placeholder="Color" /></Field>
                      <Field label="Size"><Input {...register('frame.size')} placeholder="Size" /></Field>
                      <Field label="Barcode / Ref"><Input {...register('frame.barcode')} placeholder="Barcode or reference" /></Field>
                      <PriceField disabled={frame.isReference} registration={register('frame.total', { valueAsNumber: true })} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search inventory, or scan the frame's barcode */}
                    <Field label="Find the frame" error={errors.frame?.selectionId?.message}>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="min-w-0 flex-1">
                          <VariantPicker
                            value={selectedFrameVariant}
                            onChange={(v) => { setFrameSource('variant'); applyFrameVariantSelection(v) }}
                            showStock
                            showPrice
                            placeholder="Search brand, model, color or size…"
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={openScanner} disabled={isScanningProduct} className="shrink-0 gap-2">
                          <RiScanLine className="h-4 w-4" />
                          {isScanningProduct ? 'Scanning…' : 'Scan barcode'}
                        </Button>
                      </div>
                    </Field>

                    {/* Details appear once a frame is chosen; the price can be adjusted here */}
                    {(selectedFrameVariant || frame.selectionId) ? (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected frame</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <Field label="Model"><Input {...register('frame.model')} placeholder="Frame model" /></Field>
                          <Field label="Color"><Input {...register('frame.color')} placeholder="Color" /></Field>
                          <Field label="Size"><Input {...register('frame.size')} placeholder="Size" /></Field>
                          <Field label="Barcode / SKU"><Input {...register('frame.barcode')} placeholder="Barcode or SKU" /></Field>
                          <PriceField registration={register('frame.total', { valueAsNumber: true })} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
                        <RiBox3Line className="mb-2 h-6 w-6 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No frame selected yet</p>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">Search above or scan the frame's barcode</p>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      Frame not in inventory, or the patient's own frame?{' '}
                      <Button type="button" variant="link" className="h-auto p-0" onClick={() => setValue('frame.isOld', true, { shouldDirty: true })}>
                        Enter it manually
                      </Button>
                    </p>
                  </>
                )}

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
                    <CardTitle className="flex items-center gap-2">
                      Lens Selection
                      <Badge variant="secondary" className="text-xs font-normal">Optional</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Skip this step for a frame-only order</p>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-5">
                {lens.isOld ? (
                  /* Manual mode: historical (with price) or reference-only (no charge) */
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-600 dark:bg-amber-950/30">
                      <div className="flex items-center gap-2.5">
                        <RiHistoryLine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Entering the lens manually</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">For lenses not in the catalog</p>
                        </div>
                      </div>
                      <Button
                        type="button" variant="outline" size="sm" className="shrink-0"
                        onClick={() => {
                          setValue('lens.isOld', false, { shouldDirty: true })
                          setValue('lens.isReference', false, { shouldDirty: true })
                        }}
                      >
                        Search catalog instead
                      </Button>
                    </div>
                    {/* Reference-only sub-toggle */}
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer select-none transition-all ${
                        lens.isReference
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                          : 'border-border bg-muted/10 hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        const next = !lens.isReference
                        setValue('lens.isReference', next, { shouldDirty: true })
                        if (next) setValue('lens.total', 0, { shouldDirty: true })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <RiFileTextLine className={`h-3.5 w-3.5 ${lens.isReference ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                        <div>
                          <p className={`text-xs font-semibold ${lens.isReference ? 'text-blue-800 dark:text-blue-300' : 'text-foreground'}`}>
                            Reference only — no charge
                          </p>
                          <p className={`text-xs ${lens.isReference ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {lens.isReference ? 'Existing lens noted for records — $0, no stock change' : 'Toggle on if noting an existing lens the patient already has (e.g. frame-change visit)'}
                          </p>
                        </div>
                      </div>
                      <div
                        role="checkbox"
                        aria-checked={lens.isReference}
                        onClick={(e) => e.stopPropagation()}
                        className={`h-4 w-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                          lens.isReference ? 'bg-blue-500 border-blue-500' : 'border-blue-400/60 bg-transparent'
                        }`}
                      >
                        {lens.isReference && <RiCheckLine className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Field label="Lens Type"><Input {...register('lens.lensType')} placeholder="e.g. Single Vision" /></Field>
                      <Field label="Color"><Input {...register('lens.color')} placeholder="Color" /></Field>
                      <Field label="Size"><Input {...register('lens.size')} placeholder="Size" /></Field>
                      <Field label="Code"><Input {...register('lens.lensId')} placeholder="Lens code" /></Field>
                      <PriceField disabled={lens.isReference} registration={register('lens.total', { valueAsNumber: true })} />
                    </div>
                  </div>
                ) : (
                  <>
                    <Field label="Find the lens" error={errors.lens?.selectionId?.message}>
                      <SearchableLOV
                        placeholder="Search lens type, color, size…"
                        value={lens.selectionId || ''}
                        onChange={(value) => {
                          const lensType = lensMasterData?.data.find((item) => String(item.id) === String(value))
                          if (lensType) { applyLensSelection(lensType); return }
                          setValue('lens.selectionId', value, { shouldDirty: true, shouldValidate: true })
                        }}
                        options={lensOptions}
                      />
                    </Field>

                    {lens.selectionId ? (
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected lens</p>
                          <Button
                            type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                            onClick={() => setValue('lens', defaultValues.lens, { shouldDirty: true, shouldValidate: false })}
                          >
                            Remove lens
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <Field label="Lens Type"><Input {...register('lens.lensType')} placeholder="e.g. Single Vision" /></Field>
                          <Field label="Color"><Input {...register('lens.color')} placeholder="Color" /></Field>
                          <Field label="Size"><Input {...register('lens.size')} placeholder="Size" /></Field>
                          <Field label="Code"><Input {...register('lens.lensId')} placeholder="Lens code" /></Field>
                          <PriceField registration={register('lens.total', { valueAsNumber: true })} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
                        <RiSparklingLine className="mb-2 h-6 w-6 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No lens — this will be a frame-only order</p>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">Search above to add a lens, or continue to the next step</p>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      Lens not in the catalog?{' '}
                      <Button type="button" variant="link" className="h-auto p-0" onClick={() => setValue('lens.isOld', true, { shouldDirty: true })}>
                        Enter it manually
                      </Button>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Extras ──────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Accessories from stock */}
              <Card>
                <SectionHeader
                  icon={RiShoppingBag3Line}
                  title="Accessories"
                  description="Drops, solutions, cases and other items sold from stock"
                  aside={generalItems.length > 0 && <Badge variant="secondary" className="shrink-0">{generalItems.length} added</Badge>}
                />
                <Separator />
                <CardContent className="pt-5 space-y-3">
                  <SearchableLOV
                    placeholder="Search accessories and supplies…"
                    value=""
                    onChange={(value) => {
                      const product = productData?.data.find((p) => p.product_id === value)
                      if (!product) return
                      setGeneralItems((prev) => {
                        const existing = prev.findIndex((i) => i.productId === value)
                        if (existing >= 0) {
                          const next = [...prev]
                          next[existing] = { ...next[existing], qty: next[existing].qty + 1 }
                          return next
                        }
                        return [...prev, { productId: product.product_id, productName: product.name, sku: product.sku, qty: 1, unitPrice: product.selling_price }]
                      })
                    }}
                    options={generalInventoryOptions}
                  />
                  {generalItems.length > 0 ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {generalItems.map((item, i) => (
                        <li key={item.productId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.sku} · {formatCurrency(item.unitPrice)} each</p>
                          </div>
                          <QtyStepper value={item.qty} itemName={item.productName} onChange={(qty) => changeAccessoryQty(i, qty - item.qty)} />
                          <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(item.unitPrice * item.qty)}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setGeneralItems((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${item.productName}`}>
                            <RiDeleteBin6Line className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyHint icon={RiShoppingBag3Line}>Nothing added — search above to add an item.</EmptyHint>
                  )}
                </CardContent>
              </Card>

              {/* Services & charges */}
              <Card>
                <SectionHeader
                  icon={RiToolsLine}
                  title="Services & Charges"
                  description="Fitting, tinting, repairs and other fees"
                  aside={
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground"
                      onClick={() => { setNewExpenseName(''); setNewExpenseCost(0); setNewExpenseDialogOpen(true) }}>
                      <RiAddLine className="mr-1 size-3.5" />New charge type
                    </Button>
                  }
                />
                <Separator />
                <CardContent className="pt-5 space-y-4">
                  {/* One tap adds a common charge; tapping it again adds one more */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Tap to add</p>
                    <div className="flex flex-wrap gap-2">
                      {(expenseMasterData?.data || []).slice(0, 8).map((type) => {
                        const addedQty = Number((expenses || []).find((e) => e.expenseTypeId === type.id)?.qty || 0)
                        return (
                          <Button key={type.id} type="button" variant="outline" size="sm"
                            className={`h-8 gap-1.5 rounded-full ${addedQty ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : ''}`}
                            onClick={() => quickAddCharge(type)}>
                            {addedQty ? <RiCheckLine className="size-3.5" /> : <RiAddLine className="size-3.5" />}
                            {type.name}
                            <span className={addedQty ? 'text-primary/70' : 'text-muted-foreground'}>{formatCurrency(type.default_cost)}</span>
                            {addedQty > 1 && (
                              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">×{addedQty}</span>
                            )}
                          </Button>
                        )
                      })}
                      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full" onClick={addExpenseRow}>
                        <RiAddLine className="mr-1 size-3.5" />Other charge
                      </Button>
                    </div>
                    {!(expenseMasterData?.data || []).length && (
                      <p className="text-xs text-muted-foreground">
                        No charge types set up yet — use “New charge type” to create your common ones (e.g. Fitting).
                      </p>
                    )}
                  </div>

                  {expenseFields.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <div className="hidden grid-cols-[minmax(0,1fr)_100px_110px_100px_96px_32px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                        <span>Charge</span><span>Qty</span><span className="text-right">Price</span>
                        <span className="text-right">Discount</span><span className="text-right">Amount</span><span />
                      </div>
                      <ul className="divide-y divide-border">
                        {expenseFields.map((field, index) => (
                          <li key={field.id}
                            className="grid grid-cols-2 items-end gap-x-3 gap-y-2 p-3 sm:grid-cols-[minmax(0,1fr)_100px_110px_100px_96px_32px] sm:items-center sm:py-2">
                            <div className="col-span-2 sm:col-span-1">
                              <SearchableLOV placeholder="Select charge" value={expenses?.[index]?.expenseTypeId || ''}
                                onChange={(value) => updateExpenseRow(index, 'expenseTypeId', value)} options={expenseOptions} />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[11px] text-muted-foreground sm:hidden">Qty</span>
                              <QtyStepper value={Number(expenses?.[index]?.qty || 0)} itemName="charge"
                                onChange={(qty) => updateExpenseRow(index, 'qty', qty)} />
                            </div>
                            <label className="space-y-1">
                              <span className="text-[11px] text-muted-foreground sm:hidden">Price</span>
                              <Input type="number" min={0} step="0.01" className="text-right" aria-label="Price"
                                value={expenses?.[index]?.unitCost || 0} onFocus={(e) => e.target.select()}
                                onChange={(e) => updateExpenseRow(index, 'unitCost', Number(e.target.value))} />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] text-muted-foreground sm:hidden">Discount</span>
                              <Input type="number" min={0} step="0.01" className="text-right" aria-label="Discount"
                                value={expenses?.[index]?.discount || 0} onFocus={(e) => e.target.select()}
                                onChange={(e) => updateExpenseRow(index, 'discount', Number(e.target.value))} />
                            </label>
                            <span className="self-center text-right text-sm font-semibold tabular-nums">{formatCurrency(expenses?.[index]?.total || 0)}</span>
                            <Button type="button" variant="ghost" size="sm" className="col-span-2 h-8 w-8 justify-self-end self-center p-0 text-muted-foreground hover:text-destructive sm:col-span-1"
                              onClick={() => remove(index)} aria-label="Remove charge">
                              <RiDeleteBin6Line className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <EmptyHint icon={RiToolsLine}>No charges yet — tap one above to add it.</EmptyHint>
                  )}
                </CardContent>
              </Card>

              {/* Free items — last: they cost the patient nothing and stay off the invoice */}
              {!salesOrder.isOld && (
                <Card>
                  <SectionHeader
                    icon={RiGiftLine}
                    tone="emerald"
                    title="Free With This Order"
                    description="Anything given at no charge. It comes out of stock but doesn't print on the invoice or receipts."
                    aside={freeProducts.length > 0 && (
                      <Badge variant="secondary" className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        {freeProducts.length} free
                      </Badge>
                    )}
                  />
                  <Separator />
                  <CardContent className="pt-5 space-y-3">
                    <SearchableLOV placeholder="Add a free item…" value="" onChange={addFreeItem} options={freeItemOptions} />

                    {showFreeSuggestion && suggestedCase && (
                      <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5">
                        <RiSparklingFill className="size-4 shrink-0 text-primary" />
                        <p className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{suggestedCase.product_name}</span>
                          <span className="text-muted-foreground"> is suggested for this frame price</span>
                        </p>
                        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => addFreeItem(suggestedCase.product_id)}>
                          <RiAddLine className="mr-1 size-3.5" />Add
                        </Button>
                      </div>
                    )}

                    {freeProducts.length > 0 ? (
                      <ul className="divide-y divide-border rounded-lg border border-emerald-200 dark:border-emerald-900">
                        {freeProducts.map((product) => (
                          <li key={product.product_id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <RiGiftLine className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{product.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {product.sku}
                                {suggestedCase?.product_id === product.product_id ? ' · Suggested for this frame price' : ''}
                              </p>
                            </div>
                            <span className="rounded-full bg-emerald-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">Free</span>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFreeItem(product.product_id)} aria-label={`Remove ${product.name}`}>
                              <RiDeleteBin6Line className="size-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyHint icon={RiGiftLine}>Nothing free on this order. Search above to add an item.</EmptyHint>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Inline create charge type dialog */}
              <Dialog open={newExpenseDialogOpen} onOpenChange={(open) => !open && setNewExpenseDialogOpen(false)}>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>New Charge Type</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-expense-name">Name</Label>
                      <Input id="new-expense-name" placeholder="e.g. Lens Coating" value={newExpenseName} onChange={(e) => setNewExpenseName(e.target.value)} autoFocus />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-expense-cost">Default price</Label>
                      <Input id="new-expense-cost" type="number" min={0} step="0.01" placeholder="0.00" value={newExpenseCost || ''} onChange={(e) => setNewExpenseCost(Number(e.target.value))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setNewExpenseDialogOpen(false)}>Cancel</Button>
                    <Button
                      type="button"
                      disabled={!newExpenseName.trim() || createExpenseTypeMutation.isPending}
                      onClick={() => createExpenseTypeMutation.mutate({ name: newExpenseName.trim(), default_cost: newExpenseCost })}
                    >
                      {createExpenseTypeMutation.isPending ? 'Creating…' : 'Create & Add'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* What the extras add up to, in the same order as the cards above */}
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 px-5 py-3">
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Accessories</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(accessoriesTotal)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Services</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(chargesTotal)}</dd>
                  </div>
                  {!salesOrder.isOld && (
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Free items</dt>
                      <dd className="font-medium tabular-nums">{freeProducts.length}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">Extras total</span>
                  <span className="text-lg font-bold tabular-nums">{formatCurrency(roundCurrency(derivedTotals.expenseTotal))}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Order Details ───────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <Card>
                <SectionHeader
                  icon={RiCalendarLine}
                  title="When Will It Be Ready?"
                  description="The collection date is also the invoice due date unless you change it"
                />
                <Separator />
                <CardContent className="pt-5 space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Order date" required error={errors.salesOrder?.orderDate?.message}>
                      <Input type="date" {...register('salesOrder.orderDate')} />
                    </Field>
                    <Field label="Ready for collection" required error={errors.salesOrder?.deliveryDate?.message}>
                      <Input type="date" {...register('salesOrder.deliveryDate')} />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Quick pick</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {READY_IN.map(([label, days]) => {
                        const date = addDaysTo(salesOrder.orderDate || today, days)
                        const isActive = !!date && salesOrder.deliveryDate === date
                        return (
                          <Button key={label} type="button" variant="outline" aria-pressed={isActive}
                            className={`h-auto flex-col items-start gap-0 px-3 py-2 text-left ${isActive ? 'border-primary bg-primary/10 hover:bg-primary/15' : ''}`}
                            onClick={() => setDeliveryInDays(days)}>
                            <span className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>{label}</span>
                            <span className="text-xs font-normal text-muted-foreground">{date ? formatDate(date, 'EEE, MMM d') : '—'}</span>
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {readyInDays !== null && (
                    readyInDays < 0 ? (
                      <InlineAlert type="warning" title="Collection is before the order date" description="Check the two dates above." />
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-4 py-3 ring-1 ring-inset ring-primary/15">
                        <RiCalendarCheckLine className="size-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Ready {formatDate(salesOrder.deliveryDate, 'EEEE, MMMM d')}</p>
                          <p className="text-xs text-muted-foreground">
                            {readyInDays === 0 ? 'Same day as the order' : `${readyInDays} ${readyInDays === 1 ? 'day' : 'days'} after the order`}
                          </p>
                        </div>
                      </div>
                    )
                  )}

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="payment-due-on-collection" className="min-w-0 cursor-pointer">
                        <span className="block text-sm font-medium">Full payment is due on collection</span>
                        <span className="block text-xs text-muted-foreground">
                          {paymentDueSameAsDelivery
                            ? salesOrder.deliveryDate ? `Balance due ${formatDate(salesOrder.deliveryDate, 'MMM d, yyyy')}` : 'Balance due on the collection date'
                            : 'Set a different due date below'}
                        </span>
                      </label>
                      <Switch id="payment-due-on-collection" checked={paymentDueSameAsDelivery} onCheckedChange={setPaymentDueSameAsDelivery} />
                    </div>
                    {!paymentDueSameAsDelivery && (
                      <Field label="Full payment due" required error={errors.salesOrder?.dateOfFullPayment?.message} className="mt-4 sm:max-w-xs">
                        <Input type="date" {...register('salesOrder.dateOfFullPayment')} />
                      </Field>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <SectionHeader icon={RiUserHeartLine} title="Who and Where" description="Who tested the patient, and where the sale was made" />
                <Separator />
                <CardContent className="pt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Tested by" required error={errors.salesOrder?.testedBy?.message}>
                    <SearchableLOV
                      placeholder="Select who tested"
                      value={salesOrder.testedBy || ''}
                      onChange={(val: string) => setValue('salesOrder.testedBy', val, { shouldDirty: true, shouldValidate: true })}
                      options={(testedByOptions || []).map((u: any) => ({ value: u.value, label: u.label, subtitle: '' }))}
                    />
                  </Field>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium leading-none">
                      Sold at <span className="font-normal text-muted-foreground">(optional)</span>
                    </p>
                    <div role="radiogroup" aria-label="Sold at" className="grid grid-cols-2 gap-2">
                      {SALE_LOCATIONS.map((loc) => {
                        const isSelected = saleLocation === loc.key
                        return (
                          <button
                            key={loc.key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setValue('saleLocation', isSelected ? undefined : loc.key, { shouldDirty: true })}
                            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                            }`}
                          >
                            <loc.icon className="size-4 shrink-0" />
                            {loc.label}
                            {isSelected && <RiCheckLine className="ml-auto size-4" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <SectionHeader icon={RiStickyNoteLine} title="Notes" description="Optional — printed on the invoice, e.g. coating or collection instructions" />
                <Separator />
                <CardContent className="pt-5 space-y-4">
                  <Textarea {...register('remarks')} rows={3} placeholder="Add a note for this order…" className="resize-none" />
                  {salesOrder.isOld && (
                    <Field label="Original SO number (from paper records)">
                      <Input placeholder="e.g. SO-2022-0041" {...register('salesOrder.orderNumber')} />
                    </Field>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pricing panel — below xl only; xl screens have the side summary */}
          {showPricingPanel && <div className="xl:hidden"><PricingPanel derivedTotals={derivedTotals} /></div>}

          {/* ── Step 6: Review & Pay ────────────────────────────────────────── */}
          {currentStep === 6 && (
            <div className="space-y-4">
              {savedOrderNumber && (
                <InlineAlert
                  type="success"
                  title={`Order saved: ${savedOrderNumber}`}
                  description={[savedInvoice && `Invoice ${savedInvoice.invoice_number} generated.`, 'Click Done to go back to Sales Orders.'].filter(Boolean).join(' ')}
                />
              )}

              {/* Anything that would stop the order saving, with a way to fix it */}
              {reviewIssues.length > 0 && !savedOrderNumber && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2">
                    <RiAlertLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Check these before saving</p>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {reviewIssues.map((issue) => (
                      <li key={issue.message} className="flex items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
                        <span>{issue.message}</span>
                        {issue.step !== currentStep && (
                          <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={() => setCurrentStep(issue.step)}>
                            Fix
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What's being sold — wide screens already show it in the summary and invoice preview */}
              <Card className="xl:hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <RiShieldCheckLine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Check the Order</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {isFullOrder ? 'Frame + lens' : 'Frame only'}
                        {salesOrder.isOld ? ' · Past order, no invoice' : ' · An invoice is created when you save'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-2">
                  <div className="divide-y divide-border">
                    {[
                      { label: 'Patient', detail: patient.newData.fullName ? `${patient.newData.fullName} · ${patient.newData.phone}` : 'Not entered', step: 0 },
                      { label: 'Prescription', detail: summaryExtras.prescription?.label || 'Not entered', step: 1 },
                      { label: 'Frame', detail: frame.model || (frame.isReference ? 'Patient\'s own frame' : 'Not selected'), amount: derivedTotals.frameTotal, step: 2 },
                      { label: 'Lens', detail: lens.lensType || 'None — frame-only order', amount: derivedTotals.lensTotal, step: 3 },
                      {
                        label: 'Extras',
                        detail: invoicePreview.lines.filter((l) => !['Frame', 'Lens'].includes(l.type)).map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(', ') || 'None',
                        amount: derivedTotals.expenseTotal,
                        step: 4,
                      },
                      {
                        label: 'Order details',
                        detail: [salesOrder.deliveryDate && `Ready ${formatDate(salesOrder.deliveryDate, 'MMM d')}`, testedByName && `tested by ${testedByName}`, summaryExtras.soldAt]
                          .filter(Boolean).join(' · ') || 'Not entered',
                        step: 5,
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <p className="truncate text-sm font-medium">{row.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {row.amount !== undefined && row.amount > 0 && (
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(roundCurrency(row.amount))}</span>
                          )}
                          {!savedOrderNumber && (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentStep(row.step)}>
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <PaymentPanel
                subtotal={derivedTotals.subtotalBeforeDiscount}
                discountTotal={derivedTotals.discountTotal}
                total={derivedTotals.subtotal}
                paid={salesOrder.isOld ? 0 : derivedTotals.advancedPayment}
                balance={derivedTotals.balancePayment}
                discountType={totals.discountType}
                discountValue={Number(totals.discount || 0)}
                onDiscountChange={(type, value) => {
                  setValue('totals.discountType', type, { shouldDirty: true })
                  setValue('totals.discount', value, { shouldDirty: true })
                }}
                onPaidChange={(amount) => setValue('totals.advancedPayment', amount, { shouldDirty: true })}
                dueDate={salesOrder.dateOfFullPayment}
                isHistorical={salesOrder.isOld}
                invoiceNumber={savedInvoice?.invoice_number || totals.invoiceNumber || undefined}
              />

              {/* Balance still to pay (with or without an advance today): hand the customer a slip now;
                  the full receipt prints when they pay the rest */}
              {savedInvoice && !salesOrder.isOld && hasBalanceDue(savedInvoice) && (
                <Button type="button" className="w-full gap-2" onClick={() => setShowAdvanceReceipt(true)}>
                  <RiPrinterLine className="h-4 w-4" />
                  Print {receiptSlipLabel(savedInvoice)}
                </Button>
              )}

              {savedInvoice && !salesOrder.isOld && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={handleDownloadInvoicePdf} disabled={isDownloadingPdf}>
                    {isDownloadingPdf ? <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" /> : <RiDownloadLine className="mr-2 h-4 w-4" />}
                    Download invoice PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(`/invoices?detail=${savedInvoice.invoice_id}`)}>
                    <RiEyeLine className="mr-2 h-4 w-4" />
                    View invoice
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation — sticks to the bottom so it's always in reach ───── */}
          <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-between gap-3 rounded-t-xl border-t border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex min-w-0 items-center gap-3">
              {currentStep > 0 && !savedOrderNumber && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <RiArrowLeftSLine className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
              )}
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                {savedOrderNumber
                  ? `Saved as ${savedOrderNumber}`
                  : currentStep < STEPS.length - 1
                    ? `Up next: ${STEPS[currentStep + 1].label}`
                    : `Total ${formatCurrency(roundCurrency(derivedTotals.subtotal))}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {showInvoicePreview && (
                <Button type="button" variant="ghost" className="xl:hidden" onClick={() => setShowPreviewDialog(true)}>
                  <RiFileTextLine className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Preview invoice</span>
                </Button>
              )}
              {savedOrderNumber ? (
                <>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Create Another Order
                  </Button>
                  <Button type="button" onClick={() => navigate('/sales-orders')}>
                    <RiCheckLine className="mr-1.5 h-4 w-4" />
                    Done
                  </Button>
                </>
              ) : currentStep < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  {currentStep === 3 && !lens.selectionId && !lens.isOld ? 'Skip — no lens' : 'Next'}
                  <RiArrowRightSLine className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" disabled={isSaving} onClick={handleSubmitClick}>
                  {isSaving ? (
                    <><RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <>{isEditingOrder ? 'Save Changes' : 'Create Sales Order'}<RiArrowRightSLine className="ml-1.5 h-4 w-4" /></>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
        </div>

        {/* ── Right column — order summary; from Extras on it can switch to the invoice preview ── */}
        <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] space-y-3 overflow-y-auto xl:block">
          {showInvoicePreview && (
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
                {([['summary', 'Order summary'], ['preview', 'Invoice preview']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeRightPanel === key}
                    onClick={() => setRightPanel(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeRightPanel === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {savedInvoice && (
                <Button type="button" size="sm" variant="outline" onClick={handleDownloadInvoicePdf} disabled={isDownloadingPdf}>
                  <RiDownloadLine className="mr-1.5 h-4 w-4" />PDF
                </Button>
              )}
            </div>
          )}
          {showInvoicePreview && activeRightPanel === 'preview' ? (
            <>
              <InvoicePreview data={invoicePreview} company={companyProfile} />
              <InvoicePreviewStatus data={invoicePreview} />
            </>
          ) : (
            <OrderSummaryPanel data={invoicePreview} extras={summaryExtras} goTo={goToStep} />
          )}
        </aside>
        </div>
      </div>
    </>
  )
}

export default SalesOrderIntakeForm
