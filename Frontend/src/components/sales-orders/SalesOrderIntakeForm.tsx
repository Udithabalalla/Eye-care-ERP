import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Scan,
  Trash02,
  Clock,
} from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
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

const phoneDigits = (value: string) => value.replace(/\D/g, '')

const optionalNumber = () =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const numericValue = Number(value)
    return Number.isNaN(numericValue) ? undefined : numericValue
  }, z.number().min(0).optional())

const requiredMoney = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return 0
  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? 0 : numericValue
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
    if (!value.patient.existingId) {
      if (!value.patient.newData.gender) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Gender is required for new patients', path: ['patient', 'newData', 'gender'] })
      }
    }

    if (!value.salesOrder.isOld) {
      const hasFrame = value.frame.selectionId || value.frame.model.trim()
      const hasLens = value.lens.selectionId || value.lens.lensType.trim()
      if (!hasFrame) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frame selection is required', path: ['frame', 'selectionId'] })
      }
      if (!hasLens) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Lens selection is required', path: ['lens', 'selectionId'] })
      }
    }
  })

type SalesOrderIntakeValues = z.infer<typeof salesOrderIntakeSchema>

interface SectionProps {
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'info'
}

interface LookupOption {
  label: string
  subtitle: string
  value: string
}

const SectionCard = ({ title, subtitle, isOpen, onToggle, children, className = '', icon, variant = 'default' }: SectionProps) => {
  const variantStyles = {
    default: 'border-border bg-card hover:bg-card/80',
    success: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30',
    info: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
  }

  return (
    <Card className={`${variantStyles[variant]} transition-all duration-200 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start gap-3">
          {icon && <div className="mt-1 flex-shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex-shrink-0">
          {isOpen ? 
            <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" /> : 
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
          }
        </div>
      </button>
      <Separator className="m-0" />
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-5 p-6">{children}</div>
      </div>
    </Card>
  )
}

// Alert wrapper component
const FormAlert = ({ type, title, description }: { type: 'info' | 'warning' | 'error' | 'success'; title: string; description: string }) => {
  const variantConfig = {
    info: { icon: AlertCircle, className: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30' },
    warning: { icon: AlertCircle, className: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30' },
    error: { icon: AlertCircle, className: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30' },
    success: { icon: AlertCircle, className: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30' },
  }

  const config = variantConfig[type]
  const Icon = config.icon || AlertCircle

  return (
    <div className={`rounded-lg border p-4 ${config.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm mt-1 opacity-90">{description}</p>
        </div>
      </div>
    </div>
  )
}

// Field group wrapper for better organization
const FieldGroup = ({ 
  children, 
  label,
  cols = 1 
}: { 
  children: React.ReactNode
  label?: string
  cols?: 1 | 2 | 3 | 4 | 5
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
  }

  return (
    <div>
      {label && <h3 className="mb-4 text-sm font-semibold text-foreground/80">{label}</h3>}
      <div className={`grid grid-cols-1 gap-4 ${gridCols[cols]}`}>
        {children}
      </div>
    </div>
  )
}

const today = new Date().toISOString().split('T')[0]

const defaultValues: SalesOrderIntakeValues = {
  patient: {
    existingId: '',
    newData: {
      fullName: '',
      phone: '',
      age: undefined,
      gender: undefined,
      address: '',
    },
  },
  prescription: {
    existingId: '',
    newData: {
      prescriptionDate: today,
      validUntil: today,
      diagnosis: '',
      notes: '',
      rightEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
      leftEye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pd: 0 },
    },
  },
  salesOrder: {
    isOld: false,
    deliveryDate: today,
    orderNumber: '',
    testedBy: '',
    orderDate: today,
  },
  frame: {
    selectionId: '',
    barcode: '',
    model: '',
    color: '',
    size: '',
    frameId: '',
    total: 0,
  },
  lens: {
    selectionId: '',
    lensType: '',
    color: '',
    size: '',
    lensId: '',
    total: 0,
  },
  expenses: [],
  totals: {
    discount: 0,
    advancedPayment: 0,
    fullPaymentDate: '',
    invoiceNumber: '',
  },
  remarks: '',
}

const normalizeText = (value: string) => value.trim().toLowerCase()

const formatAddress = (patient: Patient) => {
  const address = patient.address
  if (!address) return ''
  return [address.street, address.city, address.state, address.zip_code, address.country]
    .filter(Boolean)
    .join(', ')
}

const mapPrescriptionToForm = (prescription: Prescription) => ({
  prescriptionDate: prescription.prescription_date ? String(prescription.prescription_date).split('T')[0] : today,
  validUntil: prescription.valid_until ? String(prescription.valid_until).split('T')[0] : today,
  diagnosis: prescription.diagnosis || '',
  notes: prescription.notes || '',
  rightEye: {
    sphere: prescription.eye_prescription?.right_eye.sphere ?? 0,
    cylinder: prescription.eye_prescription?.right_eye.cylinder ?? 0,
    axis: prescription.eye_prescription?.right_eye.axis ?? 0,
    add: prescription.eye_prescription?.right_eye.add ?? 0,
    pd: prescription.eye_prescription?.right_eye.pupillary_distance ?? 0,
  },
  leftEye: {
    sphere: prescription.eye_prescription?.left_eye.sphere ?? 0,
    cylinder: prescription.eye_prescription?.left_eye.cylinder ?? 0,
    axis: prescription.eye_prescription?.left_eye.axis ?? 0,
    add: prescription.eye_prescription?.left_eye.add ?? 0,
    pd: prescription.eye_prescription?.left_eye.pupillary_distance ?? 0,
  },
})

const buildPatientPayload = (values: SalesOrderIntakeValues['patient']) => ({
  name: values.newData.fullName,
  date_of_birth: values.newData.age ? new Date(new Date().setFullYear(new Date().getFullYear() - values.newData.age)).toISOString().split('T')[0] : today,
  gender: values.newData.gender || Gender.OTHER,
  phone: values.newData.phone,
  address: values.newData.address
    ? { street: values.newData.address }
    : undefined,
})

const buildPrescriptionPayload = (
  patientId: string,
  values: SalesOrderIntakeValues['prescription']
) => ({
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

const SummaryRow = ({ label, value, isCurrency = true }: { label: string; value: number; isCurrency?: boolean }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{isCurrency ? formatCurrency(roundCurrency(value)) : value}</span>
    </div>
  )
}

const SalesOrderIntakeForm = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [savedOrderNumber, setSavedOrderNumber] = useState('')
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    patient: true,
    prescription: true,
    salesOrder: true,
    frame: true,
    lens: true,
    expenses: true,
    remarks: false,
    summary: true,
    totals: true,
  })

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['sales-order-products-master'],
    queryFn: async () => {
      const firstPage = await productsApi.getAll({ page: 1, page_size: 100 })
      if (firstPage.total_pages <= 1) {
        return firstPage
      }

      const allItems = [...firstPage.data]
      for (let page = 2; page <= firstPage.total_pages; page += 1) {
        const nextPage = await productsApi.getAll({ page, page_size: 100 })
        allItems.push(...nextPage.data)
      }

      return {
        ...firstPage,
        data: allItems,
        page: 1,
        page_size: allItems.length,
      }
    },
  })

  const { data: lensMasterData } = useLensMaster({ page: 1, page_size: 100, is_active: true })
  const { data: expenseMasterData } = useOtherExpenses({ page: 1, page_size: 100, is_active: true })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    clearErrors,
    formState: { errors },
  } = useForm<SalesOrderIntakeValues>({
    resolver: zodResolver(salesOrderIntakeSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  const expenses = useWatch({ control, name: 'expenses' })
  const frame = useWatch({ control, name: 'frame' })
  const lens = useWatch({ control, name: 'lens' })
  const patient = useWatch({ control, name: 'patient' })
  const prescription = useWatch({ control, name: 'prescription' })
  const salesOrder = useWatch({ control, name: 'salesOrder' })
  const totals = useWatch({ control, name: 'totals' })

  const { data: matchingPatients } = usePatientSearch(
    `${patient.newData.phone || ''} ${patient.newData.fullName || ''}`
  )

  const { data: patientPrescriptions } = usePrescriptionFetch(patient.existingId || undefined)
  const { isScannerOpen: barcodeScannerOpen, openScanner, closeScanner, scanBarcode, isScanningProduct } = useBarcodeScanner()

  const { fields: expenseFields, append, remove } = useFieldArray({
    control,
    name: 'expenses',
  })

  const frameOptions = useMemo<LookupOption[]>(() => {
    const frameCategories = new Set<ProductCategory>([
      ProductCategory.FRAMES,
      ProductCategory.SUNGLASSES,
    ])

    return (productData?.data || [])
      .filter((product) => frameCategories.has(product.category) && product.current_stock > 0)
      .map((product) => ({
        value: product.product_id,
        label: product.name,
        subtitle: `${product.sku} ${product.barcode ? `• ${product.barcode}` : ''} • ${formatCurrency(product.selling_price)}`,
      }))
  }, [productData])

  const lensOptions = useMemo<LookupOption[]>(() => {
    return (lensMasterData?.data || [])
      .map((product) => ({
        value: product.id,
        label: product.lens_type,
        subtitle: `${product.color} • ${product.size} • ${product.lens_code} • ${formatCurrency(product.price)}`,
      }))
  }, [lensMasterData])

  const expenseOptions = useMemo<LookupOption[]>(() => {
    return (expenseMasterData?.data || []).map((expense) => ({
      value: expense.id,
      label: expense.name,
      subtitle: formatCurrency(expense.default_cost),
    }))
  }, [expenseMasterData])

  const matchedPatient = useMemo(() => {
    const results = matchingPatients?.data || []
    const phone = phoneDigits(patient.newData.phone || '')
    if (!phone && !patient.newData.fullName.trim()) return results[0] || null

    return (
      results.find((item) => phoneDigits(item.phone) === phone) ||
      results.find((item) => normalizeText(item.name).includes(normalizeText(patient.newData.fullName))) ||
      results[0] ||
      null
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
    return (
      productData?.data?.find((item) =>
        [item.name, item.sku, item.barcode, item.product_id]
          .filter(Boolean)
          .some((candidate) => normalizeText(String(candidate)).includes(manualValue))
      ) || null
    )
  }, [frame.barcode, frame.frameId, frame.model, frame.selectionId, productData])

  const resolvedLens = useMemo(() => {
    return lensMasterData?.data?.find((item) => item.id === lens.selectionId) || null
  }, [lens.selectionId, lensMasterData])

  const derivedTotals = useMemo(() => {
    return calculateOrderTotals({
      frameTotal: frame.total || 0,
      lensTotal: lens.total || 0,
      expenses: (expenses || []).map((item) => ({
        qty: Number(item.qty || 0),
        unitCost: Number(item.unitCost || 0),
        discount: Number(item.discount || 0),
      })),
      discount: Number(totals.discount || 0),
      advancedPayment: Number(totals.advancedPayment || 0),
      isOldOrder: salesOrder.isOld,
    })
  }, [expenses, frame.total, lens.total, salesOrder.isOld, totals.advancedPayment, totals.discount])

  useEffect(() => {
    setValue('totals.advancedPayment', derivedTotals.advancedPayment, { shouldDirty: false, shouldValidate: false })
    setValue('totals.fullPaymentDate', derivedTotals.fullPaymentDate, { shouldDirty: false, shouldValidate: false })
    if (salesOrder.isOld) {
      setValue('totals.invoiceNumber', '', { shouldDirty: false, shouldValidate: false })
    }
  }, [derivedTotals.advancedPayment, derivedTotals.fullPaymentDate, salesOrder.isOld, setValue])

  useEffect(() => {
    if (!salesOrder.isOld) {
      return
    }
    if (!getValues('totals.fullPaymentDate')) {
      setValue('totals.fullPaymentDate', today, { shouldDirty: false, shouldValidate: false })
    }
  }, [getValues, salesOrder.isOld, setValue])

  useEffect(() => {
    if (prescription.existingId || prescription.newData.diagnosis || prescription.newData.notes) {
      clearErrors('prescription')
    }
  }, [clearErrors, prescription.existingId, prescription.newData.diagnosis, prescription.newData.notes])

  const createPatientMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patientsApi.create>[0]) => patientsApi.create(payload),
  })

  const createPrescriptionMutation = useMutation({
    mutationFn: (payload: Parameters<typeof prescriptionsApi.create>[0]) => prescriptionsApi.create(payload),
  })

  const createSalesOrderMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesOrdersApi.create>[0]) => salesOrdersApi.create(payload),
  })

  const generateInvoiceMutation = useMutation({
    mutationFn: (orderId: string) => salesOrdersApi.generateInvoice(orderId),
  })

  const setSectionOpen = (section: string) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const applyFrameSelection = (product: Product) => {
    const mapped = mapProductToFrame(product)
    setValue('frame', mapped, { shouldDirty: true, shouldValidate: true })
  }

  const handlePatientAction = (patientRecord: Patient) => {
    setValue('patient.existingId', patientRecord.patient_id, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.fullName', patientRecord.name, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.phone', patientRecord.phone, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.age', patientRecord.age, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.gender', patientRecord.gender, { shouldDirty: true, shouldValidate: true })
    setValue('patient.newData.address', formatAddress(patientRecord), { shouldDirty: true, shouldValidate: true })
    toast.success(`Linked to ${patientRecord.name}`)
  }

  const continueAsNew = () => {
    const phone = phoneDigits(patient.newData.phone || '')
    const matchedPhone = phoneDigits(matchedPatient?.phone || '')
    if (matchedPhone && phone === matchedPhone) {
      toast.error('Phone number already exists. Please use a different number.')
      return
    }
    setValue('patient.existingId', '', { shouldDirty: true, shouldValidate: true })
    toast.success('Continuing as a new patient')
  }

  const addExpenseRow = () => {
    append({
      expenseTypeId: '',
      expenseTypeName: '',
      qty: 1,
      unitCost: 0,
      discount: 0,
      total: 0,
    })
  }

  const updateExpenseRow = (index: number, field: keyof SalesOrderIntakeValues['expenses'][number], value: string | number) => {
    const current = getValues('expenses')
    const next = [...current]
    const row = { ...next[index] }
    ;(row as any)[field] = value

    if (field === 'expenseTypeId') {
      const expenseType = expenseMasterData?.data.find((item) => item.id === value)
      if (expenseType) {
        row.expenseTypeName = expenseType.name
        if (!row.unitCost) row.unitCost = expenseType.default_cost
      } else if (!value) {
        row.expenseTypeName = ''
      }
    }

    row.total = calculateLineTotal({ qty: Number(row.qty || 0), unitCost: Number(row.unitCost || 0), discount: Number(row.discount || 0) })
    next[index] = row
    setValue('expenses', next, { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    const nextExpenses = (expenses || []).map((row) => ({
      ...row,
      total: calculateLineTotal({
        qty: Number(row.qty || 0),
        unitCost: Number(row.unitCost || 0),
        discount: Number(row.discount || 0),
      }),
    }))
    const hasDifference = nextExpenses.some((row, index) => row.total !== expenses[index]?.total)
    if (hasDifference) {
      setValue('expenses', nextExpenses, { shouldDirty: true, shouldValidate: false })
    }
  }, [expenses, setValue])

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

  const onSubmit = async (values: SalesOrderIntakeValues) => {
    try {
      const phone = phoneDigits(values.patient.newData.phone)
      const exactDuplicate = (matchingPatients?.data || []).find((item) => phoneDigits(item.phone) === phone)

      if (!values.patient.existingId && exactDuplicate) {
        toast.error('Phone number already exists. Please use a different number.')
        return
      }

      const patientId = values.patient.existingId || (
        await createPatientMutation.mutateAsync(buildPatientPayload(values.patient))
      ).patient_id

      const shouldCreatePrescription =
        !values.prescription.existingId &&
        Boolean(
          values.prescription.newData.diagnosis.trim() ||
          values.prescription.newData.notes.trim() ||
          values.prescription.newData.rightEye.sphere !== 0 ||
          values.prescription.newData.rightEye.cylinder !== 0 ||
          values.prescription.newData.leftEye.sphere !== 0 ||
          values.prescription.newData.leftEye.cylinder !== 0
        )

      let prescriptionId = values.prescription.existingId || ''

      if (shouldCreatePrescription) {
        const createdPrescription = await createPrescriptionMutation.mutateAsync(
          buildPrescriptionPayload(patientId, values.prescription)
        )
        prescriptionId = createdPrescription.prescription_id
      }

      const frameItem = values.frame.selectionId ? resolvedFrame : null
      if (!frameItem) {
        toast.error('Frame selection is required')
        return
      }

      const lensItem = resolvedLens
      if (!values.salesOrder.isOld && !lensItem) {
        toast.error('Lens selection is required')
        return
      }

      if (!values.salesOrder.isOld) {
        const invalidExpense = (values.expenses || []).some((expense) => !expense.expenseTypeId || !expenseMasterData?.data.some((item) => item.id === expense.expenseTypeId))
        if (invalidExpense) {
          toast.error('Expense type must come from master data')
          return
        }
      }

      const itemPayload: SalesOrderItem[] = [
        {
          product_id: frameItem.product_id,
          product_name: values.frame.model || frameItem.name,
          sku: values.frame.frameId || frameItem.sku,
          quantity: 1,
          unit_price: Number(values.frame.total || frameItem.selling_price),
          total: Number(values.frame.total || frameItem.selling_price),
          master_data_id: frameItem.product_id,
          line_type: 'product' as const,
          track_stock: true,
        },
      ]

      if (lensItem || values.salesOrder.isOld) {
        itemPayload.push({
          product_id: lensItem?.id || values.lens.lensId || 'LENS',
          product_name: values.lens.lensType || lensItem?.lens_type || 'Lens',
          sku: values.lens.lensId || lensItem?.lens_code || 'LENS',
          quantity: 1,
          unit_price: Number(values.lens.total || lensItem?.price || 0),
          total: Number(values.lens.total || lensItem?.price || 0),
          master_data_id: lensItem?.id,
          line_type: 'lens' as const,
          track_stock: false,
        })
      }

      itemPayload.push(
        ...values.expenses.map((expense) => {
          const selectedExpense = expenseMasterData?.data.find((item) => item.id === expense.expenseTypeId)
          return {
            product_id: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE',
            product_name: expense.expenseTypeName || selectedExpense?.name || 'Expense',
            sku: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE',
            quantity: Number(expense.qty || 0),
            unit_price: Number(expense.unitCost || 0),
            total: calculateLineTotal({
              qty: Number(expense.qty || 0),
              unitCost: Number(expense.unitCost || 0),
              discount: Number(expense.discount || 0),
            }),
            master_data_id: selectedExpense?.id || expense.expenseTypeId || undefined,
            line_type: 'expense' as const,
            track_stock: false,
          }
        })
      )

      const orderPayload = {
        patient_id: patientId,
        prescription_id: prescriptionId || undefined,
        tested_by: values.salesOrder.testedBy,
        expected_delivery_date: values.salesOrder.deliveryDate,
        notes: [
          values.remarks.trim(),
          values.salesOrder.isOld ? `Legacy SO Number: ${values.salesOrder.orderNumber || 'manual entry'}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        measurements: {
          order_date: values.salesOrder.orderDate,
          order_type: isFullOrder ? 'FULL_ORDER' : 'PARTIAL_ORDER',
          frame_total: values.frame.total,
          lens_total: values.lens.total,
          other_expenses_total: derivedTotals.expenseTotal,
          discount: values.totals.discount,
          advance_payment: values.totals.advancedPayment,
        },
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
        toast.success(`Historical sales order saved as ${createdOrder.order_number}`)
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Failed to save sales order'
      toast.error(message)
    }
  }

  const handleReset = () => {
    reset(defaultValues)
    setSavedOrderNumber('')
    setSavedInvoice(null)
  }

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const product = await scanBarcode(barcode)
      if (!product) {
        toast.error('Frame not found for this barcode')
        return
      }
      applyFrameSelection(product)
      toast.success(`Frame loaded: ${product.name}`)
      closeScanner()
    } catch {
      toast.error('Frame not found for this barcode')
    }
  }

  if (isLoadingProducts) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-border bg-card">
        <Loading text="Loading sales order masters..." />
      </div>
    )
  }

  return (
    <>
      <QRScanner isOpen={barcodeScannerOpen} onScan={handleBarcodeScan} onClose={closeScanner} />

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="border-0 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
                  Sales Order Intake
                </div>
                <CardTitle className="text-3xl sm:text-4xl">Create a guided order</CardTitle>
                <CardDescription className="mt-3 max-w-2xl text-base">
                  Streamlined workflow for patient lookup, prescriptions, frame/lens selection, and invoice generation. All in one place.
                </CardDescription>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                  <span className="text-xs font-medium text-foreground">
                    {isFullOrder ? 'FULL ORDER' : 'PARTIAL ORDER'}
                  </span>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${
                  salesOrder.isOld 
                    ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30' 
                    : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                }`}>
                  <div className={`h-2 w-2 rounded-full ${salesOrder.isOld ? 'bg-yellow-600' : 'bg-green-600'}`}></div>
                  <span className={`text-xs font-medium ${salesOrder.isOld ? 'text-yellow-900' : 'text-green-900'}`}>
                    {salesOrder.isOld ? 'Historical' : 'Invoice Eligible'}
                  </span>
                </div>
                {savedOrderNumber && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-semibold text-foreground">SO {savedOrderNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Patient Information */}
          <SectionCard
            title="Patient Information"
            subtitle="Create new or link existing patient record"
            isOpen={openSections.patient}
            onToggle={() => setSectionOpen('patient')}
            variant={patientIsLinked ? 'success' : 'default'}
          >
            <div className="space-y-5">
              <FieldGroup label="Patient Details" cols={2}>
                <Input
                  label="Full Name *"
                  placeholder="John Doe"
                  error={errors.patient?.newData?.fullName?.message}
                  {...register('patient.newData.fullName')}
                  disabled={patientIsLinked}
                />
                <Input
                  label="Phone Number *"
                  placeholder="0771234567"
                  error={errors.patient?.newData?.phone?.message}
                  {...register('patient.newData.phone')}
                  disabled={patientIsLinked}
                />
                <Input
                  label="Age"
                  type="number"
                  min={0}
                  placeholder="34"
                  error={errors.patient?.newData?.age?.message as string | undefined}
                  {...register('patient.newData.age')}
                  disabled={patientIsLinked}
                />
                <div>
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Gender {!patientIsLinked && '*'}</label>
                  <select
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm bg-background text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.patient?.newData?.gender ? 'border-red-500' : 'border-input'}`}
                    {...register('patient.newData.gender')}
                    disabled={patientIsLinked}
                  >
                    <option value="">Select gender</option>
                    <option value={Gender.MALE}>Male</option>
                    <option value={Gender.FEMALE}>Female</option>
                    <option value={Gender.OTHER}>Other</option>
                  </select>
                  {errors.patient?.newData?.gender && <p className="mt-1 text-xs text-red-600">{errors.patient.newData.gender.message}</p>}
                </div>
              </FieldGroup>

              <FieldGroup label="Delivery Address">
                <Input
                  label="Address"
                  placeholder="Street address or delivery note"
                  {...register('patient.newData.address')}
                  disabled={patientIsLinked}
                />
              </FieldGroup>

              {matchedPatient && !patientIsLinked && (
                <FormAlert
                  type="warning"
                  title="Existing Patient Found"
                  description={`${matchedPatient.name} (${matchedPatient.phone})`}
                />
              )}

              {matchedPatient && !patientIsLinked && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button 
                    type="button" 
                    onClick={() => handlePatientAction(matchedPatient)}
                    className="flex-1 sm:flex-auto"
                  >
                    Use Existing Patient
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={continueAsNew}
                    className="flex-1 sm:flex-auto"
                  >
                    Continue as New
                  </Button>
                </div>
              )}

              {patientIsLinked && (
                <FormAlert
                  type="info"
                  title="Patient Linked"
                  description="Fields are locked. Click 'Continue as New' to unlock and edit."
                />
              )}
            </div>
          </SectionCard>

          {/* Section 2: Prescription */}
          <SectionCard
            title="Prescription & Eye Measurements"
            subtitle="Link existing or create new prescription"
            isOpen={openSections.prescription}
            onToggle={() => setSectionOpen('prescription')}
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Select Prescription</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={prescription.existingId || ''}
                    onChange={(event) => {
                      const selectedId = event.target.value
                      setValue('prescription.existingId', selectedId, { shouldDirty: true, shouldValidate: true })
                      const selectedPrescription = (patientPrescriptions?.data || []).find((item) => item.prescription_id === selectedId)
                      if (selectedPrescription) {
                        setValue('prescription.newData', mapPrescriptionToForm(selectedPrescription), { shouldDirty: true, shouldValidate: false })
                      }
                    }}
                    disabled={!patient.existingId}
                  >
                    <option value="">{patient.existingId ? 'Select linked prescription' : 'Link a patient first'}</option>
                    {(patientPrescriptions?.data || []).map((item) => (
                      <option key={item.prescription_id} value={item.prescription_id}>
                        {item.prescription_date ? String(item.prescription_date).split('T')[0] : item.prescription_id}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: true })
                    setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false })
                  }}
                >
                  + New Prescription
                </Button>
              </div>

              <div className="rounded-lg border border-input bg-muted/40 p-4">
                <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">OD</span>
                  Right Eye
                </h3>
                <FieldGroup cols={5}>
                  <Input label="Sphere" type="number" step="0.25" {...register('prescription.newData.rightEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Cylinder" type="number" step="0.25" {...register('prescription.newData.rightEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Axis" type="number" step="1" {...register('prescription.newData.rightEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Add" type="number" step="0.25" {...register('prescription.newData.rightEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="PD" type="number" step="0.1" {...register('prescription.newData.rightEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                </FieldGroup>
              </div>

              <div className="rounded-lg border border-input bg-muted/40 p-4">
                <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">OS</span>
                  Left Eye
                </h3>
                <FieldGroup cols={5}>
                  <Input label="Sphere" type="number" step="0.25" {...register('prescription.newData.leftEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Cylinder" type="number" step="0.25" {...register('prescription.newData.leftEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Axis" type="number" step="1" {...register('prescription.newData.leftEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="Add" type="number" step="0.25" {...register('prescription.newData.leftEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  <Input label="PD" type="number" step="0.1" {...register('prescription.newData.leftEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                </FieldGroup>
              </div>

              <FieldGroup label="Prescription Details" cols={2}>
                <Input label="Diagnosis" {...register('prescription.newData.diagnosis')} disabled={prescriptionIsLinked} />
                <Input label="Notes" {...register('prescription.newData.notes')} disabled={prescriptionIsLinked} />
              </FieldGroup>
            </div>
          </SectionCard>

          {/* Section 3: Sales Order Information */}
          <SectionCard
            title="Sales Order Details"
            subtitle="Order dates, delivery info, and order type selection"
            isOpen={openSections.salesOrder}
            onToggle={() => setSectionOpen('salesOrder')}
          >
            <div className="space-y-5">
              <FieldGroup label="Order Dates & Person" cols={4}>
                <Input label="Order Date *" type="date" error={errors.salesOrder?.orderDate?.message} {...register('salesOrder.orderDate')} />
                <Input label="Delivery Date *" type="date" error={errors.salesOrder?.deliveryDate?.message} {...register('salesOrder.deliveryDate')} />
                <Input label="Tested By *" placeholder="Optometrist name" error={errors.salesOrder?.testedBy?.message} {...register('salesOrder.testedBy')} />
                <Input 
                  label="SO Number" 
                  placeholder={salesOrder.isOld ? 'Legacy #' : 'Auto-generated'} 
                  {...register('salesOrder.orderNumber')}
                  disabled={!salesOrder.isOld}
                />
              </FieldGroup>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-foreground">Order Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${
                    !salesOrder.isOld 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      className="mt-1"
                      checked={!salesOrder.isOld}
                      onChange={() => setValue('salesOrder.isOld', false, { shouldDirty: true, shouldValidate: true })}
                    />
                    <div>
                      <p className="font-semibold text-foreground">New Sales Order</p>
                      <p className="text-sm text-muted-foreground">Auto-generate SO# and invoice</p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${
                    salesOrder.isOld 
                      ? 'border-yellow-600 bg-yellow-50 dark:bg-yellow-950/30' 
                      : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      className="mt-1"
                      checked={salesOrder.isOld}
                      onChange={() => setValue('salesOrder.isOld', true, { shouldDirty: true, shouldValidate: true })}
                    />
                    <div>
                      <p className="font-semibold text-foreground">Historical Entry</p>
                      <p className="text-sm text-muted-foreground">Legacy paper order entry</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 4 & 5: Frame & Lens (Side by Side) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Frame Selection"
              subtitle="Scan or browse from inventory"
              isOpen={openSections.frame}
              onToggle={() => setSectionOpen('frame')}
            >
              <div className="space-y-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={openScanner}
                  isLoading={isScanningProduct}
                  className="w-full"
                >
                  <Scan className="mr-2 h-4 w-4" /> Scan Barcode
                </Button>

                <Separator />

                <FieldGroup label="Frame Details" cols={2}>
                  <SearchableLOV
                    label="Frame List"
                    placeholder="Select frame"
                    value={frame.selectionId || ''}
                    onChange={(value) => {
                      setValue('frame.selectionId', value, { shouldDirty: true, shouldValidate: true })
                      const product = productData?.data.find((item) => item.product_id === value)
                      if (product) applyFrameSelection(product)
                    }}
                    options={frameOptions}
                  />
                  <Input label="Price" type="number" step="0.01" {...register('frame.total', { valueAsNumber: true })} />
                  <Input label="Model" {...register('frame.model')} />
                  <Input label="Color" {...register('frame.color')} />
                  <Input label="Size" {...register('frame.size')} />
                  <Input label="Barcode/SKU" {...register('frame.barcode')} />
                </FieldGroup>
              </div>
            </SectionCard>

            <SectionCard
              title="Lens Selection"
              subtitle="From basic data master"
              isOpen={openSections.lens}
              onToggle={() => setSectionOpen('lens')}
            >
              <div className="space-y-4">
                <FieldGroup label="Lens Details" cols={2}>
                  <SearchableLOV
                    label="Lens List"
                    placeholder="Select lens"
                    value={lens.selectionId || ''}
                    onChange={(value) => {
                      setValue('lens.selectionId', value, { shouldDirty: true, shouldValidate: true })
                      const lensType = lensMasterData?.data.find((item) => item.id === value)
                      if (lensType) {
                        setValue('lens.lensType', lensType.lens_type, { shouldDirty: true, shouldValidate: true })
                        setValue('lens.color', lensType.color, { shouldDirty: true, shouldValidate: true })
                        setValue('lens.size', lensType.size, { shouldDirty: true, shouldValidate: true })
                        setValue('lens.lensId', lensType.lens_code, { shouldDirty: true, shouldValidate: true })
                        setValue('lens.total', lensType.price, { shouldDirty: true, shouldValidate: true })
                      }
                    }}
                    options={lensOptions}
                  />
                  <Input label="Price" type="number" step="0.01" {...register('lens.total', { valueAsNumber: true })} />
                  <Input label="Lens Type" {...register('lens.lensType')} />
                  <Input label="Color" {...register('lens.color')} />
                  <Input label="Size" {...register('lens.size')} />
                  <Input label="Code" {...register('lens.lensId')} />
                </FieldGroup>
              </div>
            </SectionCard>
          </div>

          {/* Section 6: Expenses */}
          <SectionCard
            title="Other Expenses"
            subtitle="Additional charges and services"
            isOpen={openSections.expenses}
            onToggle={() => setSectionOpen('expenses')}
          >
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => addExpenseRow()}
                >
                  + Add Expense
                </Button>
              </div>

              {expenseFields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No expenses added yet
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-input">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-input bg-muted/50">
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Expense Type</th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Qty</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Unit Cost</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Discount</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expenseFields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <SearchableLOV
                              placeholder="Select expense"
                              value={expenses?.[index]?.expenseTypeId || ''}
                              onChange={(value) => updateExpenseRow(index, 'expenseTypeId', value)}
                              options={expenseOptions}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Input 
                              type="number" 
                              min={0} 
                              step="1" 
                              value={expenses?.[index]?.qty || 0} 
                              onChange={(e) => updateExpenseRow(index, 'qty', Number(e.target.value))}
                              className="text-center"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Input 
                              type="number" 
                              min={0} 
                              step="0.01" 
                              value={expenses?.[index]?.unitCost || 0} 
                              onChange={(e) => updateExpenseRow(index, 'unitCost', Number(e.target.value))}
                              className="text-right"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Input 
                              type="number" 
                              min={0} 
                              step="0.01" 
                              value={expenses?.[index]?.discount || 0} 
                              onChange={(e) => updateExpenseRow(index, 'discount', Number(e.target.value))}
                              className="text-right"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(expenses?.[index]?.total || 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <Trash02 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Section 7: Remarks */}
          <SectionCard
            title="Remarks & Notes"
            subtitle="Additional information for the order"
            isOpen={openSections.remarks}
            onToggle={() => setSectionOpen('remarks')}
          >
            <textarea
              {...register('remarks')}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Add any notes or special instructions..."
            />
          </SectionCard>

          {/* Section 8 & 9: Summary & Totals (Side by Side) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Order Summary"
              subtitle="Commercial components breakdown"
              isOpen={openSections.summary}
              onToggle={() => setSectionOpen('summary')}
            >
              <div className="space-y-3">
                <SummaryRow label="Frame Total" value={derivedTotals.frameTotal} />
                <SummaryRow label="Lens Total" value={derivedTotals.lensTotal} />
                <SummaryRow label="Other Expenses" value={derivedTotals.expenseTotal} />
                <Separator />
                <SummaryRow label="Subtotal" value={derivedTotals.subtotal} isCurrency />
                <div className="rounded-lg border-2 border-primary bg-primary/5 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order Type</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isFullOrder ? '✓ Full Order' : '○ Partial Order'}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Financial Summary"
              subtitle="Payment and invoice details"
              isOpen={openSections.totals}
              onToggle={() => setSectionOpen('totals')}
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-input bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Balance Due</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {formatCurrency(roundCurrency(derivedTotals.subtotal))}
                  </p>
                </div>

                <FieldGroup label="Payment Info" cols={1}>
                  <Input
                    label="Advanced/Partial Payment"
                    type="number"
                    min={0}
                    step="0.01"
                    value={totals.advancedPayment || 0}
                    onChange={(e) => setValue('totals.advancedPayment', Number(e.target.value), { shouldDirty: true })}
                    disabled={salesOrder.isOld}
                  />
                </FieldGroup>

                <div className="rounded-lg border border-input bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Outstanding Balance</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatCurrency(roundCurrency(derivedTotals.balancePayment))}
                  </p>
                </div>

                <FieldGroup label="Payment Schedule" cols={1}>
                  <Input
                    label="Date of Full Payment"
                    type="date"
                    value={totals.fullPaymentDate || ''}
                    onChange={(e) => setValue('totals.fullPaymentDate', e.target.value, { shouldDirty: true })}
                    disabled={salesOrder.isOld}
                  />
                </FieldGroup>

                {!salesOrder.isOld && (
                  <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Invoice Status</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {totals.invoiceNumber || savedInvoice?.invoice_number 
                            ? `Invoice ${totals.invoiceNumber || savedInvoice?.invoice_number}` 
                            : 'Generated after save'
                          }
                        </p>
                      </div>
                    </div>
                    {(savedInvoice || totals.invoiceNumber) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => navigate(`/invoices?detail=${savedInvoice?.invoice_id || totals.invoiceNumber}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> View Invoice
                      </Button>
                    )}
                  </div>
                )}

                {salesOrder.isOld && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30 p-4">
                    <p className="text-sm font-semibold text-yellow-900">Historical Entry</p>
                    <p className="text-sm text-yellow-700 mt-1">No invoice will be generated</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Action Buttons */}
          <Separator className="my-6" />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleReset}
            >
              Reset Draft
            </Button>
            <Button 
              type="submit"
              isLoading={createPatientMutation.isPending || createPrescriptionMutation.isPending || createSalesOrderMutation.isPending || generateInvoiceMutation.isPending}
            >
              Save Sales Order
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

export default SalesOrderIntakeForm
