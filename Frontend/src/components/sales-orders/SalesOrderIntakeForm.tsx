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
  SearchLg,
  Trash02,
} from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { productsApi } from '@/api/products.api'
import { salesOrdersApi } from '@/api/erp.api'
import { Invoice } from '@/types/invoice.types'
import { Gender, ProductCategory } from '@/types/common.types'
import { Patient } from '@/types/patient.types'
import { Prescription } from '@/types/prescription.types'
import { Product } from '@/types/product.types'
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
  expenseTypeGroup: z.enum(['repair', 'soldering', 'other']).default('repair'),
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
}

interface LookupOption {
  label: string
  subtitle: string
  value: string
}

interface ExpenseTemplateOption {
  id: string
  label: string
  group: 'repair' | 'soldering' | 'other'
  defaultUnitCost: number
}

const expenseTemplates: ExpenseTemplateOption[] = [
  { id: 'soldering', label: 'Soldering', group: 'soldering', defaultUnitCost: 0 },
  { id: 'nose-pad', label: 'Nose pad replacement', group: 'repair', defaultUnitCost: 0 },
  { id: 'frame-arm', label: 'Frame arm replacement', group: 'repair', defaultUnitCost: 0 },
  { id: 'frame-adjust', label: 'Frame adjustment', group: 'repair', defaultUnitCost: 0 },
]

const SectionCard = ({ title, subtitle, isOpen, onToggle, children, className = '' }: SectionProps) => {
  return (
    <section className={`rounded-3xl border border-secondary bg-primary shadow-sm ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 border-b border-secondary px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-tertiary">{subtitle}</p>}
        </div>
        {isOpen ? <ChevronUp className="h-5 w-5 text-tertiary" /> : <ChevronDown className="h-5 w-5 text-tertiary" />}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-5">{children}</div>
      </div>
    </section>
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

const mapProductToLens = (product: Product) => ({
  selectionId: product.product_id,
  lensType: product.name,
  color: product.specifications?.color ? String(product.specifications.color) : product.brand || '',
  size: product.specifications?.size ? String(product.specifications.size) : product.unit_of_measure || '',
  lensId: product.sku,
  total: product.selling_price,
})

const SalesOrderIntakeForm = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [savedOrderNumber, setSavedOrderNumber] = useState('')
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [quickExpenseId, setQuickExpenseId] = useState(expenseTemplates[0].id)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    patient: true,
    prescription: true,
    salesOrder: true,
    frame: true,
    lens: true,
    expenses: true,
    remarks: true,
    summary: true,
    totals: true,
  })

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['sales-order-products-master'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })

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
    return (productData?.data || [])
      .filter((product) => product.category === ProductCategory.FRAMES)
      .map((product) => ({
        value: product.product_id,
        label: product.name,
        subtitle: `${product.sku} ${product.barcode ? `• ${product.barcode}` : ''} • ${formatCurrency(product.selling_price)}`,
      }))
  }, [productData])

  const lensOptions = useMemo<LookupOption[]>(() => {
    return (productData?.data || [])
      .filter((product) => product.category === ProductCategory.CONTACT_LENSES || product.category === ProductCategory.EYEGLASSES)
      .map((product) => ({
        value: product.product_id,
        label: product.name,
        subtitle: `${product.sku} ${product.barcode ? `• ${product.barcode}` : ''} • ${formatCurrency(product.selling_price)}`,
      }))
  }, [productData])

  const expenseOptions = expenseTemplates.map((item) => ({
    value: item.id,
    label: item.label,
    subtitle: item.group,
  }))

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
    const selected = productData?.data?.find((item) => item.product_id === lens.selectionId)
    if (selected) return selected
    const manualValue = normalizeText(lens.lensType || lens.lensId)
    if (!manualValue) return null
    return (
      productData?.data?.find((item) =>
        [item.name, item.sku, item.barcode, item.product_id]
          .filter(Boolean)
          .some((candidate) => normalizeText(String(candidate)).includes(manualValue))
      ) || null
    )
  }, [lens.lensId, lens.lensType, lens.selectionId, productData])

  const derivedTotals = useMemo(() => {
    return calculateOrderTotals({
      frameTotal: frame.total || 0,
      lensTotal: lens.total || 0,
      expenses: (expenses || []).map((item) => ({
        qty: Number(item.qty || 0),
        unitCost: Number(item.unitCost || 0),
        discount: Number(item.discount || 0),
        expenseTypeGroup: item.expenseTypeGroup,
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

  const applyLensSelection = (product: Product) => {
    const mapped = mapProductToLens(product)
    setValue('lens', mapped, { shouldDirty: true, shouldValidate: true })
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

  const addExpenseRow = (template?: ExpenseTemplateOption) => {
    append({
      expenseTypeId: template?.id || '',
      expenseTypeName: template?.label || '',
      expenseTypeGroup: template?.group || 'repair',
      qty: 1,
      unitCost: template?.defaultUnitCost || 0,
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
      const template = expenseTemplates.find((item) => item.id === value)
      if (template) {
        row.expenseTypeName = template.label
        row.expenseTypeGroup = template.group
        if (!row.unitCost) row.unitCost = template.defaultUnitCost
      }
    }

    row.total = calculateLineTotal({ qty: Number(row.qty || 0), unitCost: Number(row.unitCost || 0), discount: Number(row.discount || 0), expenseTypeGroup: row.expenseTypeGroup })
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
        expenseTypeGroup: row.expenseTypeGroup,
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
      setValue('lens.lensType', resolvedLens.name, { shouldDirty: false, shouldValidate: false })
      setValue('lens.color', resolvedLens.specifications?.color ? String(resolvedLens.specifications.color) : resolvedLens.brand || '', { shouldDirty: false, shouldValidate: false })
      setValue('lens.size', resolvedLens.specifications?.size ? String(resolvedLens.specifications.size) : resolvedLens.unit_of_measure || '', { shouldDirty: false, shouldValidate: false })
      setValue('lens.lensId', resolvedLens.sku, { shouldDirty: false, shouldValidate: false })
      setValue('lens.total', resolvedLens.selling_price, { shouldDirty: false, shouldValidate: false })
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
      const lensItem = values.lens.selectionId ? resolvedLens : null

      if (!frameItem || !lensItem) {
        toast.error('Full order requires both frame and lens')
        return
      }

      const itemPayload = [
        {
          product_id: frameItem.product_id,
          product_name: values.frame.model || frameItem.name,
          sku: values.frame.frameId || frameItem.sku,
          quantity: 1,
          unit_price: Number(values.frame.total || frameItem.selling_price),
          total: Number(values.frame.total || frameItem.selling_price),
        },
        {
          product_id: lensItem.product_id,
          product_name: values.lens.lensType || lensItem.name,
          sku: values.lens.lensId || lensItem.sku,
          quantity: 1,
          unit_price: Number(values.lens.total || lensItem.selling_price),
          total: Number(values.lens.total || lensItem.selling_price),
        },
        ...values.expenses.map((expense) => ({
          product_id: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE',
          product_name: expense.expenseTypeName || 'Expense',
          sku: expense.expenseTypeId || expense.expenseTypeName || 'EXPENSE',
          quantity: Number(expense.qty || 0),
          unit_price: Number(expense.unitCost || 0),
          total: calculateLineTotal({
            qty: Number(expense.qty || 0),
            unitCost: Number(expense.unitCost || 0),
            discount: Number(expense.discount || 0),
            expenseTypeGroup: expense.expenseTypeGroup,
          }),
        })),
      ]

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
          repair_total: derivedTotals.repairTotal,
          soldering_total: derivedTotals.solderingTotal,
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
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-secondary bg-primary shadow-sm">
        <Loading text="Loading sales order masters..." />
      </div>
    )
  }

  return (
    <>
      <QRScanner isOpen={barcodeScannerOpen} onScan={handleBarcodeScan} onClose={closeScanner} />

      <div className="relative overflow-hidden rounded-[2rem] border border-secondary bg-primary shadow-[0_24px_80px_-24px_rgba(0,0,0,0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,163,74,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_24%)]" />

        <div className="relative border-b border-secondary px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Sales Order Intake</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">Create a guided order for walk-in patients</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-tertiary">
                This workflow keeps patient lookup, prescriptions, frame/lens selection, legacy paper entry, and invoice generation separate while preserving the order life cycle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
                {isFullOrder ? 'Order Type: FULL ORDER' : 'Order Type: PARTIAL ORDER'}
              </div>
              <div className={`rounded-full px-4 py-2 text-sm font-semibold ${salesOrder.isOld ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>
                {salesOrder.isOld ? 'Historical Entry' : 'Invoice Eligible'}
              </div>
              {savedOrderNumber && (
                <div className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-primary">
                  SO {savedOrderNumber}
                </div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-6 px-6 py-6 sm:px-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Section 1 - Patient Information"
              subtitle="Default to a new patient. Search by phone or name to link an existing record."
              isOpen={openSections.patient}
              onToggle={() => setSectionOpen('patient')}
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-secondary bg-secondary/40 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Full Name *"
                      placeholder="John Doe"
                      error={errors.patient?.newData?.fullName?.message}
                      {...register('patient.newData.fullName')}
                      disabled={patientIsLinked}
                    />
                    <Input
                      label="Phone *"
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
                      <label className="mb-1.5 block text-sm font-medium text-secondary">Gender *</label>
                      <select
                        className={`w-full rounded-xl border bg-primary px-3 py-2.5 text-sm text-primary transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${errors.patient?.newData?.gender ? 'border-error-500' : 'border-secondary'}`}
                        {...register('patient.newData.gender')}
                        disabled={patientIsLinked}
                      >
                        <option value="">Select gender</option>
                        <option value={Gender.MALE}>Male</option>
                        <option value={Gender.FEMALE}>Female</option>
                        <option value={Gender.OTHER}>Other</option>
                      </select>
                      {errors.patient?.newData?.gender && <p className="mt-1 text-sm text-error-600">{errors.patient.newData.gender.message}</p>}
                    </div>
                  </div>
                  <div className="mt-4">
                    <Input
                      label="Address"
                      placeholder="Street address or short delivery note"
                      {...register('patient.newData.address')}
                      disabled={patientIsLinked}
                    />
                  </div>
                </div>

                {matchedPatient && !patientIsLinked && (
                  <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-warning-700">
                          <AlertCircle className="h-4 w-4" /> Existing patient found: {matchedPatient.name} ({matchedPatient.phone})
                        </p>
                        <p className="mt-1 text-sm text-warning-700/90">Link the patient to avoid duplicate records or continue as a new patient only if the phone number changes.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="primary" size="sm" onClick={() => handlePatientAction(matchedPatient)}>
                          Use Existing Patient
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={continueAsNew}>
                          Continue as New
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {patientIsLinked && (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-700">Linked patient record</p>
                        <p className="text-sm text-brand-600">The fields are locked until you choose Continue as New.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setValue('patient.existingId', '', { shouldDirty: true })}>
                        Continue as New
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Section 2 - Prescription"
              subtitle="Select an existing prescription or add a new one without leaving the page."
              isOpen={openSections.prescription}
              onToggle={() => setSectionOpen('prescription')}
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-secondary">Select Prescription</label>
                    <select
                      className="w-full rounded-xl border border-secondary bg-primary px-3 py-2.5 text-sm text-primary"
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
                    size="sm"
                    className="self-end"
                    onClick={() => {
                      setValue('prescription.existingId', '', { shouldDirty: true, shouldValidate: true })
                      setValue('prescription.newData', defaultValues.prescription.newData, { shouldDirty: true, shouldValidate: false })
                    }}
                  >
                    + Add New Prescription
                  </Button>
                </div>

                <div className={`rounded-2xl border ${prescriptionIsLinked ? 'border-brand-200 bg-brand-50' : 'border-secondary bg-secondary/40'} p-4`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">Right Eye (OD)</p>
                    {prescriptionIsLinked && <span className="text-xs font-medium text-brand-700">Read only</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Input label="Sphere" type="number" step="0.25" {...register('prescription.newData.rightEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Cylinder" type="number" step="0.25" {...register('prescription.newData.rightEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Axis" type="number" step="1" {...register('prescription.newData.rightEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Add" type="number" step="0.25" {...register('prescription.newData.rightEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="PD" type="number" step="0.1" {...register('prescription.newData.rightEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  </div>
                </div>

                <div className={`rounded-2xl border ${prescriptionIsLinked ? 'border-brand-200 bg-brand-50' : 'border-secondary bg-secondary/40'} p-4`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">Left Eye (OS)</p>
                    {prescriptionIsLinked && <span className="text-xs font-medium text-brand-700">Read only</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Input label="Sphere" type="number" step="0.25" {...register('prescription.newData.leftEye.sphere', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Cylinder" type="number" step="0.25" {...register('prescription.newData.leftEye.cylinder', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Axis" type="number" step="1" {...register('prescription.newData.leftEye.axis', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="Add" type="number" step="0.25" {...register('prescription.newData.leftEye.add', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                    <Input label="PD" type="number" step="0.1" {...register('prescription.newData.leftEye.pd', { valueAsNumber: true })} disabled={prescriptionIsLinked} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input label="Diagnosis" {...register('prescription.newData.diagnosis')} disabled={prescriptionIsLinked} />
                  <Input label="Notes" {...register('prescription.newData.notes')} disabled={prescriptionIsLinked} />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Section 3 - Sales Order Information"
            subtitle="Keep the clinical order separate from financial posting and invoice generation."
            isOpen={openSections.salesOrder}
            onToggle={() => setSectionOpen('salesOrder')}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              <Input label="Delivery Date *" type="date" error={errors.salesOrder?.deliveryDate?.message} {...register('salesOrder.deliveryDate')} />
              <Input
                label="SO Number / Order Number"
                placeholder={salesOrder.isOld ? 'Enter legacy order number' : 'Generated automatically on save'}
                {...register('salesOrder.orderNumber')}
                disabled={!salesOrder.isOld}
              />
              <Input label="Tested By *" placeholder="Optometrist or staff member" error={errors.salesOrder?.testedBy?.message} {...register('salesOrder.testedBy')} />
              <Input label="Order Date *" type="date" error={errors.salesOrder?.orderDate?.message} {...register('salesOrder.orderDate')} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${!salesOrder.isOld ? 'border-brand-500 bg-brand-50' : 'border-secondary bg-secondary/40'}`}>
                <input
                  type="radio"
                  className="mt-1"
                  checked={!salesOrder.isOld}
                  onChange={() => setValue('salesOrder.isOld', false, { shouldDirty: true, shouldValidate: true })}
                />
                <div>
                  <p className="font-semibold text-primary">New Sales Order</p>
                  <p className="text-sm text-tertiary">Auto-generate the SO number and enable invoice generation after save.</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${salesOrder.isOld ? 'border-warning-500 bg-warning-50' : 'border-secondary bg-secondary/40'}`}>
                <input
                  type="radio"
                  className="mt-1"
                  checked={salesOrder.isOld}
                  onChange={() => setValue('salesOrder.isOld', true, { shouldDirty: true, shouldValidate: true })}
                />
                <div>
                  <p className="font-semibold text-primary">Old Sales Order</p>
                  <p className="text-sm text-tertiary">Use for legacy paper entries. No invoice will be generated and stock validation stays out of the workflow.</p>
                </div>
              </label>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Section 4 - Frame Information"
              subtitle="Scan a barcode or choose a frame. Frame variants are stored as unique items."
              isOpen={openSections.frame}
              onToggle={() => setSectionOpen('frame')}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={openScanner} isLoading={isScanningProduct}>
                    <Scan className="mr-2 h-4 w-4" /> Scan Barcode
                  </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (frameOptions[0]) {
                          setValue('frame.selectionId', frameOptions[0].value, { shouldDirty: true, shouldValidate: true })
                        }
                      }}
                    >
                      <Scan className="mr-2 h-4 w-4" /> Select Frame
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">Frame List</label>
                    <select
                      className="w-full rounded-xl border border-secondary bg-primary px-3 py-2.5 text-sm text-primary"
                      value={frame.selectionId || ''}
                      onChange={(event) => {
                        setValue('frame.selectionId', event.target.value, { shouldDirty: true, shouldValidate: true })
                        const product = productData?.data.find((item) => item.product_id === event.target.value)
                        if (product) applyFrameSelection(product)
                      }}
                    >
                      <option value="">Select frame</option>
                      {frameOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input label="Model" {...register('frame.model')} />
                  <Input label="Color" {...register('frame.color')} />
                  <Input label="Size" {...register('frame.size')} />
                  <Input label="Frame ID" {...register('frame.frameId')} />
                  <Input label="Total" type="number" step="0.01" {...register('frame.total', { valueAsNumber: true })} />
                  <Input label="Barcode" {...register('frame.barcode')} />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Section 5 - Lens Information"
              subtitle="Lenses come from the Basic Data master table and do not affect inventory tracking."
              isOpen={openSections.lens}
              onToggle={() => setSectionOpen('lens')}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (lensOptions[0]) {
                        setValue('lens.selectionId', lensOptions[0].value, { shouldDirty: true, shouldValidate: true })
                      }
                    }}
                  >
                    <SearchLg className="mr-2 h-4 w-4" /> Select Lens
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">Lens List</label>
                    <select
                      className="w-full rounded-xl border border-secondary bg-primary px-3 py-2.5 text-sm text-primary"
                      value={lens.selectionId || ''}
                      onChange={(event) => {
                        setValue('lens.selectionId', event.target.value, { shouldDirty: true, shouldValidate: true })
                        const product = productData?.data.find((item) => item.product_id === event.target.value)
                        if (product) applyLensSelection(product)
                      }}
                    >
                      <option value="">Select lens</option>
                      {lensOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input label="Lens Type" {...register('lens.lensType')} />
                  <Input label="Color" {...register('lens.color')} />
                  <Input label="Size" {...register('lens.size')} />
                  <Input label="Lens ID" {...register('lens.lensId')} />
                  <Input label="Total" type="number" step="0.01" {...register('lens.total', { valueAsNumber: true })} />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Section 6 - Other Expenses"
            subtitle="Use the master list to keep repair and support charges traceable."
            isOpen={openSections.expenses}
            onToggle={() => setSectionOpen('expenses')}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full max-w-sm">
                  <label className="mb-1.5 block text-sm font-medium text-secondary">Quick Add Template</label>
                  <select
                    className="w-full rounded-xl border border-secondary bg-primary px-3 py-2.5 text-sm text-primary"
                    value={quickExpenseId}
                    onChange={(event) => setQuickExpenseId(event.target.value)}
                  >
                    {expenseOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addExpenseRow()}>
                    + Add New Item
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => addExpenseRow(expenseTemplates.find((item) => item.id === quickExpenseId))}
                  >
                    + Add Item
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-secondary">
                <div className="grid grid-cols-12 bg-secondary/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tertiary">
                  <div className="col-span-3">Expense Type</div>
                  <div className="col-span-1 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Cost</div>
                  <div className="col-span-2 text-right">Discount</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>
                <div className="divide-y divide-secondary">
                  {expenseFields.length === 0 && (
                    <div className="px-4 py-6 text-sm text-tertiary">No expense items added yet.</div>
                  )}
                  {expenseFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-3 px-4 py-4">
                      <div className="col-span-12 md:col-span-3">
                        <select
                          className="w-full rounded-xl border border-secondary bg-primary px-3 py-2.5 text-sm text-primary"
                          value={expenses?.[index]?.expenseTypeId || ''}
                          onChange={(event) => updateExpenseRow(index, 'expenseTypeId', event.target.value)}
                        >
                          <option value="">Select expense</option>
                          {expenseOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <Input type="number" min={0} step="1" value={expenses?.[index]?.qty || 0} onChange={(event) => updateExpenseRow(index, 'qty', Number(event.target.value))} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input type="number" min={0} step="0.01" value={expenses?.[index]?.unitCost || 0} onChange={(event) => updateExpenseRow(index, 'unitCost', Number(event.target.value))} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input type="number" min={0} step="0.01" value={expenses?.[index]?.discount || 0} onChange={(event) => updateExpenseRow(index, 'discount', Number(event.target.value))} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Input type="text" value={formatCurrency(expenses?.[index]?.total || 0)} readOnly />
                      </div>
                      <div className="col-span-6 flex items-center justify-end md:col-span-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                          <Trash02 className="mr-2 h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Section 7 - Remarks"
            subtitle="Add any notes that should travel with the order or invoice."
            isOpen={openSections.remarks}
            onToggle={() => setSectionOpen('remarks')}
          >
            <textarea
              {...register('remarks')}
              rows={5}
              className="w-full rounded-2xl border border-secondary bg-primary px-4 py-3 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="Remarks / Notes"
            />
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Section 8 - Summary"
              subtitle="Left panel overview of the commercial components of the order."
              isOpen={openSections.summary}
              onToggle={() => setSectionOpen('summary')}
            >
              <div className="space-y-3 text-sm">
                <SummaryRow label="Frame Total" value={derivedTotals.frameTotal} />
                <SummaryRow label="Lens Total" value={derivedTotals.lensTotal} />
                <SummaryRow label="Repair Total" value={derivedTotals.repairTotal} />
                <SummaryRow label="Soldering Total" value={derivedTotals.solderingTotal} />
                <SummaryRow label="Discount" value={derivedTotals.discountTotal} isCurrency />
                <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
                  {isFullOrder ? 'Order Type: FULL ORDER' : 'Order Type: PARTIAL ORDER'}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Section 9 - Totals"
              subtitle="Right panel financial summary and invoice status."
              isOpen={openSections.totals}
              onToggle={() => setSectionOpen('totals')}
            >
              <div className="space-y-4">
                <SummaryRow label="Subtotal" value={derivedTotals.subtotal} isCurrency />
                <Input
                  label="Advanced Payment"
                  type="number"
                  min={0}
                  step="0.01"
                  value={totals.advancedPayment || 0}
                  onChange={(event) => setValue('totals.advancedPayment', Number(event.target.value), { shouldDirty: true })}
                  disabled={salesOrder.isOld}
                />
                <SummaryRow label="Balance Payment" value={derivedTotals.balancePayment} isCurrency />
                <Input
                  label="Date of full payment"
                  type="date"
                  value={totals.fullPaymentDate || ''}
                  onChange={(event) => setValue('totals.fullPaymentDate', event.target.value, { shouldDirty: true })}
                  disabled={salesOrder.isOld}
                />

                {!salesOrder.isOld ? (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-700">Invoice Number</p>
                        <p className="text-sm text-brand-600">Generated after the sales order is created.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-brand-700">{totals.invoiceNumber || savedInvoice?.invoice_number || 'Pending'}</p>
                        {(savedInvoice || totals.invoiceNumber) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => navigate(`/invoices?detail=${savedInvoice?.invoice_id || totals.invoiceNumber}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" /> View Invoice
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm font-semibold text-warning-700">
                    Historical Entry (No invoice generated)
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="flex flex-col gap-3 border-t border-secondary pt-6 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={handleReset}>
              Reset Draft
            </Button>
            <Button type="submit" variant="primary" size="lg" isLoading={createPatientMutation.isPending || createPrescriptionMutation.isPending || createSalesOrderMutation.isPending || generateInvoiceMutation.isPending}>
              Save Sales Order
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

const SummaryRow = ({ label, value, isCurrency = true }: { label: string; value: number; isCurrency?: boolean }) => {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-secondary bg-secondary/30 px-4 py-3">
      <span className="text-sm text-tertiary">{label}</span>
      <span className="text-sm font-semibold text-primary">{isCurrency ? formatCurrency(roundCurrency(value)) : value}</span>
    </div>
  )
}

export default SalesOrderIntakeForm
