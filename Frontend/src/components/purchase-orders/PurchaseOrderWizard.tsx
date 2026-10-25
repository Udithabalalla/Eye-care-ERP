import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  RiAddLine,
  RiAlertLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiBox3Line,
  RiCheckLine,
  RiCloseLine,
  RiFileEditLine,
  RiFileTextLine,
  RiGlassesLine,
  RiLoader4Line,
  RiMapPinLine,
  RiShieldCheckLine,
  RiStickyNoteLine,
  RiSubtractLine,
  RiTruckLine,
} from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import SearchableLOV from '@/components/common/SearchableLOV'
import Loading from '@/components/common/Loading'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { QuickAddVariantDialog } from '@/components/frames/QuickAddVariantDialog'
import { ProductPicker } from '@/components/purchase-orders/ProductPicker'
import AddProductAssistant from '@/components/products/AddProductAssistant'
import PurchaseOrderPreview, { PurchaseOrderPreviewData } from '@/components/purchase-orders/PurchaseOrderPreview'
import { suppliersApi } from '@/api/suppliers.api'
import { companyProfileApi } from '@/api/company-profile.api'
import { inventoryApi, LowStockItem } from '@/api/inventory.api'
import { extractApiErrorMessage } from '@/api/axios'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { FrameVariant } from '@/types/frames.types'
import { Product } from '@/types/product.types'
import { PurchaseOrder, PurchaseOrderFormData } from '@/types/supplier.types'

// ─── Form ─────────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  key: z.string(),
  kind: z.enum(['frame', 'product']),
  refId: z.string(),
  name: z.string(),
  detail: z.string().optional(),
  stock: z.number().optional(),
  quantity: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).int('Whole units only').min(1, 'At least 1'),
  unitCost: z.coerce.number({ invalid_type_error: 'Enter a cost' }).min(0, 'Can’t be negative'),
})

const schema = z
  .object({
    supplierId: z.string().min(1, 'Choose who you are ordering from'),
    orderDate: z.string().min(1, 'Pick the order date'),
    expectedDelivery: z.string().optional(),
    lines: z.array(lineSchema).min(1, 'Add at least one item'),
    shipTo: z.string().optional(),
    department: z.string().optional(),
    address: z.string().trim().min(1, 'Add where it should be delivered'),
    instructions: z.string().optional(),
    paymentTerms: z.string().optional(),
    supplierNote: z.string().optional(),
    internalNote: z.string().optional(),
    shipping: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Can’t be negative'),
    discount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Can’t be negative'),
  })
  .superRefine((values, ctx) => {
    if (values.expectedDelivery && values.expectedDelivery < values.orderDate) {
      ctx.addIssue({ code: 'custom', path: ['expectedDelivery'], message: 'Delivery can’t be before the order date' })
    }
    const subtotal = values.lines.reduce((sum, line) => sum + (line.quantity || 0) * (line.unitCost || 0), 0)
    if (values.discount > subtotal) {
      ctx.addIssue({ code: 'custom', path: ['discount'], message: 'Discount is more than the items cost' })
    }
  })

type FormValues = z.infer<typeof schema>
type Line = FormValues['lines'][number]

const STEPS = [
  { label: 'Supplier', icon: RiTruckLine, hint: 'Who you’re ordering from, and when you need it' },
  { label: 'Items', icon: RiBox3Line, hint: 'Add what you need — this supplier’s low-stock items are suggested' },
  { label: 'Delivery', icon: RiMapPinLine, hint: 'Where it should arrive, terms, and notes for the supplier' },
  { label: 'Review', icon: RiShieldCheckLine, hint: 'Check the order, add any charges, then save it' },
] as const

// Fields checked before leaving each step
const STEP_FIELDS: Array<Array<keyof FormValues>> = [
  ['supplierId', 'orderDate', 'expectedDelivery'],
  ['lines'],
  ['address', 'shipTo', 'department', 'instructions', 'paymentTerms', 'supplierNote', 'internalNote'],
  ['shipping', 'discount'],
]

const today = () => format(new Date(), 'yyyy-MM-dd')
const toDateInput = (value?: string) => (value ? format(new Date(value), 'yyyy-MM-dd') : '')
const newKey = () => crypto.randomUUID()

const emptyValues = (supplierId = ''): FormValues => ({
  supplierId,
  orderDate: today(),
  expectedDelivery: '',
  lines: [],
  shipTo: '',
  department: '',
  address: '',
  instructions: '',
  paymentTerms: '',
  supplierNote: '',
  internalNote: '',
  shipping: 0,
  discount: 0,
})

/** A saved order back into the form — as itself (draft edit) or as a fresh copy (order again) */
const orderToValues = (order: PurchaseOrder, asCopy: boolean): FormValues => ({
  supplierId: order.supplier_id,
  orderDate: asCopy ? today() : toDateInput(order.order_date),
  expectedDelivery: asCopy ? '' : toDateInput(order.expected_delivery_date),
  lines: order.items.map((item) => ({
    key: newKey(),
    kind: item.item_type ?? (item.frame_variant_id ? 'frame' : 'product'),
    refId: item.frame_variant_id || item.product_id,
    name: item.item_name || item.product_id,
    detail: [item.item_detail, item.sku].filter(Boolean).join(' · ') || undefined,
    quantity: item.quantity,
    unitCost: item.unit_cost,
  })),
  shipTo: order.shipping_information?.ship_to_location ?? '',
  department: order.shipping_information?.receiving_department ?? '',
  address: order.shipping_information?.delivery_address ?? '',
  instructions: order.shipping_information?.delivery_instructions ?? '',
  paymentTerms: order.payment_terms?.payment_terms ?? '',
  supplierNote: order.notes?.supplier_notes ?? '',
  internalNote: order.notes?.internal_notes ?? '',
  shipping: order.order_summary?.shipping_cost ?? 0,
  discount: order.order_summary?.discount ?? 0,
})

const toPayload = (values: FormValues): PurchaseOrderFormData => ({
  supplier_id: values.supplierId,
  order_date: new Date(values.orderDate).toISOString(),
  expected_delivery_date: values.expectedDelivery ? new Date(values.expectedDelivery).toISOString() : undefined,
  items: values.lines.map((line) => ({
    ...(line.kind === 'frame' ? { frame_variant_id: line.refId } : { product_id: line.refId }),
    quantity: Number(line.quantity),
    unit_cost: Number(line.unitCost),
  })),
  shipping_information: {
    ship_to_location: values.shipTo || undefined,
    delivery_address: values.address || undefined,
    receiving_department: values.department || undefined,
    delivery_instructions: values.instructions || undefined,
  },
  summary: { tax_rate: 0, shipping_cost: Number(values.shipping) || 0, discount: Number(values.discount) || 0 },
  payment_terms: values.paymentTerms ? { payment_terms: values.paymentTerms } : undefined,
  notes: { supplier_notes: values.supplierNote || undefined, internal_notes: values.internalNote || undefined },
})

const variantLine = (v: FrameVariant, quantity = 1): Line => ({
  key: newKey(),
  kind: 'frame',
  refId: v.variant_id,
  name: [v.frame_master_ref?.brand, v.frame_master_ref?.model_code].filter(Boolean).join(' ') || v.sku,
  detail: [v.color, v.eye_size ? `${v.eye_size} mm` : undefined, v.sku].filter(Boolean).join(' · '),
  stock: v.current_stock,
  quantity,
  unitCost: v.cost_price ?? 0,
})

const productLine = (p: Product, quantity = 1): Line => ({
  key: newKey(),
  kind: 'product',
  refId: p.product_id,
  name: p.name,
  detail: [p.category ? p.category.replace(/_/g, ' ') : undefined, p.sku].filter(Boolean).join(' · '),
  stock: p.current_stock,
  quantity,
  unitCost: p.cost_price ?? 0,
})

const lowStockLine = (row: LowStockItem): Line => ({
  key: newKey(),
  kind: row.kind,
  refId: row.id,
  name: row.name,
  detail: [row.detail, row.sku].filter(Boolean).join(' · ') || undefined,
  stock: row.current_stock,
  quantity: Math.max(row.suggested_qty, 1),
  unitCost: row.unit_cost ?? 0,
})

// ─── Small pieces ─────────────────────────────────────────────────────────────

const StepIndicator = ({ current, reached, onPick }: { current: number; reached: number; onPick: (step: number) => void }) => (
  // Equal-width columns keep every connector the same length
  <ol className="grid" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
    {STEPS.map((step, index) => {
      const isPast = index < current
      const isCurrent = index === current
      const isClickable = index <= reached && !isCurrent
      return (
        <li key={step.label} className="relative flex flex-col items-center gap-1.5">
          {index < STEPS.length - 1 && (
            <span
              aria-hidden
              className={cn('absolute top-[17px] h-0.5 rounded-full transition-colors duration-300', index < reached ? 'bg-primary' : 'bg-border')}
              style={{ left: 'calc(50% + 24px)', width: 'calc(100% - 48px)' }}
            />
          )}
          <button
            type="button"
            disabled={!isClickable}
            onClick={() => onPick(index)}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`Step ${index + 1}: ${step.label}`}
            className={cn(
              'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200 disabled:cursor-default',
              isCurrent
                ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20'
                : isPast
                  ? 'border-primary bg-primary text-primary-foreground hover:opacity-75'
                  : isClickable
                    ? 'border-primary bg-background text-primary hover:bg-muted/50'
                    : 'border-border bg-background text-muted-foreground',
            )}
          >
            {isPast ? <RiCheckLine className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
          </button>
          <span
            onClick={() => isClickable && onPick(index)}
            className={cn(
              'hidden max-w-full truncate px-1 text-center text-xs font-medium sm:block',
              isCurrent ? 'font-semibold text-primary dark:text-sidebar-primary' : isClickable ? 'cursor-pointer text-foreground hover:text-primary' : 'text-muted-foreground',
            )}
          >
            {step.label}
          </span>
        </li>
      )
    })}
  </ol>
)

const StepCard = ({ icon: Icon, title, subtitle, action, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    </CardHeader>
    <CardContent className="space-y-5">{children}</CardContent>
  </Card>
)

const QtyStepper = ({ value, onChange, invalid }: { value: number; onChange: (value: number) => void; invalid?: boolean }) => (
  <div className={cn('flex h-9 items-center rounded-md border border-input', invalid && 'border-destructive')}>
    <button type="button" className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value <= 1} onClick={() => onChange(Math.max(1, (Number(value) || 1) - 1))} aria-label="One fewer">
      <RiSubtractLine className="h-3.5 w-3.5" />
    </button>
    <input
      type="number"
      min={1}
      inputMode="numeric"
      value={Number.isNaN(value) ? '' : value}
      onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
      className="h-full w-12 bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      aria-label="Quantity"
    />
    <button type="button" className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => onChange((Number(value) || 0) + 1)} aria-label="One more">
      <RiAddLine className="h-3.5 w-3.5" />
    </button>
  </div>
)

const lineTotal = (line: Pick<Line, 'quantity' | 'unitCost'>) => (Number(line.quantity) || 0) * (Number(line.unitCost) || 0)

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface Props {
  /** Edit this draft PO */
  draftId?: string
  /** Start a new PO from this one ("Order again") */
  copyFromId?: string
  initialSupplierId?: string
}

const PurchaseOrderWizard = ({ draftId, copyFromId, initialSupplierId }: Props) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sourceId = draftId || copyFromId
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [aside, setAside] = useState<'preview' | 'summary'>('preview')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [addKind, setAddKind] = useState<'frame' | 'product'>('frame')
  const [newFrameOpen, setNewFrameOpen] = useState(false)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sourceLoaded, setSourceLoaded] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(initialSupplierId),
    // Pickers never blur, so check on change — a fixed field clears its message straight away
    mode: 'onChange',
  })
  const { control, getValues, setValue, trigger, reset, formState } = form
  const lineFields = useFieldArray({ control, name: 'lines', keyName: 'fieldKey' })
  const values = useWatch({ control }) as FormValues

  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  const suppliers = suppliersData?.data ?? []

  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
  })

  // Same cache as the header's stock alerts
  const { data: lowStockData } = useQuery({
    queryKey: ['inventory-low-stock', 'all', false],
    queryFn: () => inventoryApi.getLowStock(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const { data: sourceOrder, isLoading: loadingSource, isError: sourceFailed } = useQuery({
    queryKey: ['purchase-order', sourceId],
    queryFn: () => suppliersApi.getPurchaseOrder(sourceId!),
    enabled: !!sourceId,
    staleTime: 0,
  })

  // Load the draft (or the order being copied) into the form once
  useEffect(() => {
    if (!sourceOrder || sourceLoaded) return
    reset(orderToValues(sourceOrder, !draftId))
    setSourceLoaded(true)
    if (draftId) setReached(STEPS.length - 1)
  }, [sourceOrder, sourceLoaded, draftId, reset])

  // Blank delivery details start as the clinic's usual ones (new orders, and older drafts saved without them)
  useEffect(() => {
    if (!companyProfile || (sourceId && !sourceLoaded)) return
    const current = getValues()
    if (!current.address) setValue('address', companyProfile.default_delivery_address || companyProfile.address || '')
    if (!current.shipTo) setValue('shipTo', companyProfile.default_ship_to_location || '')
    if (!current.department) setValue('department', companyProfile.default_receiving_department || '')
    if (!current.instructions) setValue('instructions', companyProfile.default_delivery_instructions || '')
  }, [companyProfile, sourceId, sourceLoaded, getValues, setValue])

  const supplier = suppliers.find((s) => s.id === values.supplierId)

  // Payment terms follow the supplier unless someone typed their own
  const lastSupplierTerms = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!supplier) return
    const terms = supplier.payment_terms || ''
    const current = getValues('paymentTerms') || ''
    if (!current || current === lastSupplierTerms.current) setValue('paymentTerms', terms)
    lastSupplierTerms.current = terms
  }, [supplier, getValues, setValue])

  // Warn before closing the tab with an unsaved order
  useEffect(() => {
    if (!formState.isDirty || saved) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [formState.isDirty, saved])

  const lines = values.lines ?? []
  const suggestions = useMemo(
    () => (lowStockData?.data ?? []).filter((row) => row.supplier_id && row.supplier_id === values.supplierId),
    [lowStockData, values.supplierId],
  )
  const isOnOrder = (kind: Line['kind'], refId: string) => lines.some((line) => line.kind === kind && line.refId === refId)

  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const shipping = Number(values.shipping) || 0
  const discount = Number(values.discount) || 0
  const total = Math.max(0, subtotal - discount) + shipping
  const units = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)

  /** Add a line, or top up the quantity when it's already on the order */
  const addLine = (line: Line, quiet = false) => {
    const existing = getValues('lines').findIndex((l) => l.kind === line.kind && l.refId === line.refId)
    if (existing >= 0) {
      const current = getValues(`lines.${existing}.quantity`) || 0
      setValue(`lines.${existing}.quantity`, current + line.quantity, { shouldDirty: true, shouldValidate: true })
      if (!quiet) toast.success(`${line.name} is already on the order — quantity raised`)
      return
    }
    lineFields.append(line)
    trigger('lines')
  }

  const addAllSuggestions = () => {
    const missing = suggestions.filter((row) => !isOnOrder(row.kind, row.id))
    missing.forEach((row) => addLine(lowStockLine(row), true))
    if (missing.length) toast.success(`Added ${missing.length} low-stock item${missing.length === 1 ? '' : 's'}`)
  }

  const goTo = (target: number) => {
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step], { shouldFocus: true })
    if (!ok) return
    const target = Math.min(step + 1, STEPS.length - 1)
    setReached((r) => Math.max(r, target))
    goTo(target)
  }

  const saveMutation = useMutation({
    mutationFn: async ({ payload, approve }: { payload: PurchaseOrderFormData; approve: boolean }) => {
      const order = draftId
        ? await suppliersApi.updatePurchaseOrder(draftId, payload)
        : await suppliersApi.createPurchaseOrder(payload)
      if (!approve) return { order, approved: false }
      try {
        return { order: await suppliersApi.updatePurchaseOrderStatus(order.id, 'Approved'), approved: true }
      } catch {
        toast.error(`${order.id} was saved as a draft, but approving it failed — approve it from the order`)
        return { order, approved: false }
      }
    },
    onSuccess: ({ order, approved }) => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] })
      toast.success(approved ? `${order.id} approved — ready to send to the supplier` : draftId ? `${order.id} updated` : `${order.id} saved as a draft`)
      navigate(`/purchase-orders?detail=${order.id}`)
    },
    onError: (error: any) => {
      toast.error(extractApiErrorMessage(error?.response?.data?.detail, 'Could not save the purchase order'))
    },
  })

  const save = (approve: boolean) =>
    form.handleSubmit(
      (valid) => saveMutation.mutate({ payload: toPayload(valid), approve }),
      (errors) => {
        // Send the user to the first step with a problem
        const first = STEP_FIELDS.findIndex((fields) => fields.some((field) => field in errors))
        if (first >= 0 && first !== step) goTo(first)
        toast.error('A few things need fixing before this can be saved')
      },
    )()

  const issues = [
    !values.supplierId ? { message: 'No supplier chosen', step: 0 } : null,
    !lines.length ? { message: 'No items on the order yet', step: 1 } : null,
    lines.some((line) => !line.quantity || line.quantity < 1) ? { message: 'An item has no quantity', step: 1 } : null,
    !values.address?.trim() ? { message: 'Delivery address is missing', step: 2 } : null,
    discount > subtotal ? { message: 'Discount is more than the items cost', step: 3 } : null,
  ].filter(Boolean) as Array<{ message: string; step: number }>

  const preview: PurchaseOrderPreviewData = {
    orderNumber: draftId,
    isDraft: true,
    orderDate: values.orderDate,
    expectedDelivery: values.expectedDelivery || undefined,
    paymentTerms: values.paymentTerms || undefined,
    supplier: {
      name: supplier?.supplier_name ?? '',
      company: supplier?.company_name,
      contact: supplier?.contact_person,
      phone: supplier?.phone,
      email: supplier?.email,
      address: supplier?.address,
    },
    deliverTo: { location: values.shipTo, department: values.department, address: values.address, instructions: values.instructions },
    lines: lines.map((line) => ({
      key: line.key,
      name: line.name,
      detail: [line.kind === 'frame' ? 'Frame' : 'Product', line.detail].filter(Boolean).join(' · '),
      qty: Number(line.quantity) || 0,
      unitCost: Number(line.unitCost) || 0,
      total: lineTotal(line),
    })),
    subtotal,
    lineDiscounts: 0,
    discount,
    tax: 0,
    shipping,
    total,
    supplierNote: values.supplierNote || undefined,
  }

  if (sourceId && (loadingSource || (!sourceLoaded && !sourceFailed))) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-lg border border-border bg-card">
        <Loading text="Loading purchase order…" />
      </div>
    )
  }

  if (draftId && sourceOrder && sourceOrder.status !== 'Draft') {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 py-8 text-center">
          <RiShieldCheckLine className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">{draftId} is already {sourceOrder.status.toLowerCase()}</p>
          <p className="text-sm text-muted-foreground">Only draft purchase orders can be changed. You can start a new order from it instead.</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(`/purchase-orders?detail=${draftId}`)}>View order</Button>
            <Button onClick={() => navigate(`/purchase-orders/new?copy=${draftId}`)}>Order again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isLastStep = step === STEPS.length - 1
  const isSaving = saveMutation.isPending

  return (
    <>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase order preview</DialogTitle>
          </DialogHeader>
          <PurchaseOrderPreview data={preview} company={companyProfile} />
        </DialogContent>
      </Dialog>

      <QuickAddVariantDialog
        open={newFrameOpen}
        onClose={() => setNewFrameOpen(false)}
        onCreated={(variant) => {
          addLine(variantLine(variant))
          setNewFrameOpen(false)
        }}
      />

      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <AddProductAssistant
            isOpen={newProductOpen}
            onClose={() => setNewProductOpen(false)}
            onSuccess={(product) => {
              if (product) addLine(productLine(product))
              setNewProductOpen(false)
            }}
            lockedSupplierId={values.supplierId || undefined}
          />
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-3xl space-y-4 xl:max-w-6xl">
        {draftId && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
            <RiFileEditLine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Editing draft {draftId}.</span> Changes replace the draft; approving locks it.
            </p>
          </div>
        )}

        <div className={cn('grid items-start gap-6', aside === 'preview' ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
          <div className="min-w-0 space-y-4">
            {/* Progress — compact on mobile, full steps on sm+ */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 sm:hidden">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
                <span className="text-sm font-semibold text-foreground">{STEPS[step].label}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">{STEPS[step].hint}</p>
            </div>
            <Card className="hidden px-6 py-5 sm:block">
              <StepIndicator current={step} reached={reached} onPick={goTo} />
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Step {step + 1} of {STEPS.length}:</span> {STEPS[step].hint}
              </p>
            </Card>

            <Form {...form}>
              <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
                {/* ── Step 1: Supplier ─────────────────────────────────────── */}
                {step === 0 && (
                  <StepCard icon={RiTruckLine} title="Supplier" subtitle="Pick who you’re ordering from — their details fill in for you">
                    <FormField
                      control={control}
                      name="supplierId"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <SearchableLOV
                            label="Supplier"
                            required
                            placeholder={loadingSuppliers ? 'Loading suppliers…' : 'Search suppliers…'}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            error={fieldState.error?.message}
                            options={suppliers.map((s) => ({
                              value: s.id,
                              label: s.supplier_name,
                              subtitle: [s.company_name !== s.supplier_name ? s.company_name : undefined, s.contact_person, s.phone].filter(Boolean).join(' · ') || undefined,
                            }))}
                          />
                        </FormItem>
                      )}
                    />

                    {supplier && (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                          <p className="font-semibold text-foreground sm:col-span-2">{supplier.supplier_name}</p>
                          {supplier.contact_person && <p className="text-muted-foreground">Contact: <span className="text-foreground">{supplier.contact_person}</span></p>}
                          {supplier.phone && <p className="text-muted-foreground">Phone: <span className="text-foreground">{supplier.phone}</span></p>}
                          {supplier.email && <p className="truncate text-muted-foreground">Email: <span className="text-foreground">{supplier.email}</span></p>}
                          <p className="text-muted-foreground">Terms: <span className="text-foreground">{supplier.payment_terms || 'Not set'}</span></p>
                        </div>
                        {suggestions.length > 0 && (
                          <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <RiAlertLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {suggestions.length} item{suggestions.length === 1 ? '' : 's'} from this supplier {suggestions.length === 1 ? 'is' : 'are'} running low — you can add {suggestions.length === 1 ? 'it' : 'them'} in one click on the next step.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={control}
                        name="orderDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="expectedDelivery"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected delivery <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                            <FormControl>
                              <Input type="date" min={values.orderDate} {...field} value={field.value ?? ''} />
                            </FormControl>
                            <div className="flex flex-wrap gap-1.5">
                              {[['In 3 days', 3], ['1 week', 7], ['2 weeks', 14]].map(([label, days]) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => field.onChange(format(addDays(new Date(values.orderDate || today()), Number(days)), 'yyyy-MM-dd'))}
                                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </StepCard>
                )}

                {/* ── Step 2: Items ────────────────────────────────────────── */}
                {step === 1 && (
                  <StepCard
                    icon={RiBox3Line}
                    title="Items"
                    subtitle={supplier ? `What you’re ordering from ${supplier.supplier_name}` : 'What you’re ordering'}
                    action={lines.length > 0 && (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                        {lines.length} item{lines.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}
                      </span>
                    )}
                  >
                    {suggestions.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between gap-3 border-b border-amber-200/70 px-4 py-2.5 dark:border-amber-900/70">
                          <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                            <RiAlertLine className="h-4 w-4" />
                            Running low at {supplier?.supplier_name ?? 'this supplier'} ({suggestions.length})
                          </p>
                          <Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={addAllSuggestions} disabled={suggestions.every((row) => isOnOrder(row.kind, row.id))}>
                            Add all
                          </Button>
                        </div>
                        <ul className="max-h-56 divide-y divide-amber-200/60 overflow-y-auto dark:divide-amber-900/60">
                          {suggestions.map((row) => {
                            const added = isOnOrder(row.kind, row.id)
                            return (
                              <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 px-4 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {[row.detail, row.out_of_stock ? 'Out of stock' : `${row.current_stock} left`, `reorder at ${row.reorder_level}`].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <Button type="button" size="sm" variant={added ? 'ghost' : 'outline'} className="h-7 shrink-0 gap-1 bg-background px-2 text-xs" disabled={added} onClick={() => addLine(lowStockLine(row))}>
                                  {added ? <><RiCheckLine className="h-3.5 w-3.5" />Added</> : <><RiAddLine className="h-3.5 w-3.5" />Add {Math.max(row.suggested_qty, 1)}</>}
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Add bar */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist" aria-label="Item type">
                          {([['frame', 'Frames', RiGlassesLine], ['product', 'Products', RiBox3Line]] as const).map(([kind, label, Icon]) => (
                            <button
                              key={kind}
                              type="button"
                              role="tab"
                              aria-selected={addKind === kind}
                              onClick={() => setAddKind(kind)}
                              className={cn(
                                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                addKind === kind ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 gap-1 text-xs" onClick={() => (addKind === 'frame' ? setNewFrameOpen(true) : setNewProductOpen(true))}>
                          <RiAddLine className="h-3.5 w-3.5" />
                          New {addKind === 'frame' ? 'frame' : 'product'}
                        </Button>
                      </div>
                      {addKind === 'frame' ? (
                        <VariantPicker value={null} onChange={(variant) => variant && addLine(variantLine(variant))} showPrice={false} placeholder="Search or scan a frame to add it…" />
                      ) : (
                        <ProductPicker value={null} onChange={(product) => product && addLine(productLine(product))} placeholder="Search a product to add it…" />
                      )}
                    </div>

                    {/* Lines */}
                    {lineFields.fields.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-10 text-center">
                        <RiBox3Line className="mx-auto h-7 w-7 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium">Nothing on the order yet</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Search above, scan a barcode, or add the low-stock suggestions.</p>
                        {formState.errors.lines?.message && <p className="mt-2 text-xs text-destructive">{formState.errors.lines.message}</p>}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="hidden grid-cols-[minmax(0,1fr)_112px_120px_96px_32px] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                          <span>Item</span><span>Qty</span><span>Unit cost</span><span className="text-right">Amount</span><span />
                        </div>
                        <ul className="divide-y divide-border">
                          {lineFields.fields.map((field, index) => {
                            const line = lines[index] ?? field
                            return (
                              // Phones: name · amount · remove, then qty and cost underneath. Wider: one row.
                              <li key={field.fieldKey} className="grid grid-cols-[minmax(0,1fr)_auto_32px] items-start gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_112px_120px_96px_32px] md:items-center">
                                <div className="min-w-0 md:order-1">
                                  <p className="truncate text-sm font-medium">{line.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {[line.kind === 'frame' ? 'Frame' : 'Product', line.detail, line.stock !== undefined ? `${line.stock} in stock` : undefined].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <p className="text-right text-sm font-semibold tabular-nums md:order-4">{formatCurrency(lineTotal(line))}</p>
                                <button type="button" onClick={() => lineFields.remove(index)} className="-mt-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive md:order-5 md:mt-0" aria-label={`Remove ${line.name}`}>
                                  <RiCloseLine className="h-4 w-4" />
                                </button>
                                <div className="col-span-3 flex items-start gap-3 md:contents">
                                  <FormField
                                    control={control}
                                    name={`lines.${index}.quantity`}
                                    render={({ field: qty, fieldState }) => (
                                      <FormItem className="shrink-0 space-y-1 md:order-2">
                                        <FormLabel className="sr-only">Quantity</FormLabel>
                                        <QtyStepper value={qty.value ?? 1} onChange={qty.onChange} invalid={!!fieldState.error} />
                                        <FormMessage className="text-[11px]" />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={control}
                                    name={`lines.${index}.unitCost`}
                                    render={({ field: cost }) => (
                                      <FormItem className="min-w-0 flex-1 space-y-1 md:order-3">
                                        <FormLabel className="sr-only">Unit cost</FormLabel>
                                        <div className="relative">
                                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground md:hidden">Cost each</span>
                                          <FormControl>
                                            <Input type="number" min={0} step="0.01" inputMode="decimal" className="h-9 pl-[4.5rem] text-right tabular-nums md:pl-3 md:text-left" {...cost} value={Number.isNaN(cost.value) ? '' : cost.value} />
                                          </FormControl>
                                        </div>
                                        <FormMessage className="text-[11px]" />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2.5 text-sm">
                          <span className="text-muted-foreground">Items subtotal</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                        </div>
                      </div>
                    )}
                  </StepCard>
                )}

                {/* ── Step 3: Delivery, terms and notes ─────────────────────── */}
                {step === 2 && (
                  <>
                    <StepCard icon={RiMapPinLine} title="Delivery" subtitle={sourceId ? 'Where the supplier should deliver' : 'Filled in from your clinic settings — change it if this order goes elsewhere'}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={control} name="shipTo" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ship to</FormLabel>
                            <FormControl><Input placeholder="e.g. Main store" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={control} name="department" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Received by</FormLabel>
                            <FormControl><Input placeholder="e.g. Stores" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={control} name="address" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery address <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Textarea rows={2} placeholder="Street, city" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="instructions" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery instructions <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl><Input placeholder="e.g. Call before arriving, back entrance" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </StepCard>

                    <StepCard icon={RiStickyNoteLine} title="Terms & notes">
                      <FormField control={control} name="paymentTerms" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment terms</FormLabel>
                          <FormControl><Input placeholder="e.g. 30 days" {...field} value={field.value ?? ''} /></FormControl>
                          {supplier?.payment_terms && <FormDescription>From {supplier.supplier_name}’s record</FormDescription>}
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={control} name="supplierNote" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note to the supplier</FormLabel>
                            <FormControl><Textarea rows={3} placeholder="e.g. Pack each frame in its own case" {...field} value={field.value ?? ''} /></FormControl>
                            <FormDescription>Printed on the purchase order</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={control} name="internalNote" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Internal note</FormLabel>
                            <FormControl><Textarea rows={3} placeholder="Only your team sees this" {...field} value={field.value ?? ''} /></FormControl>
                            <FormDescription>Never printed</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </StepCard>
                  </>
                )}

                {/* ── Step 4: Review & save ─────────────────────────────────── */}
                {step === 3 && (
                  <StepCard icon={RiShieldCheckLine} title="Review & save" subtitle="Check the order, add delivery charges or a discount, then save it">
                    <dl className="divide-y divide-border rounded-lg border border-border">
                      {[
                        { label: 'Supplier', value: supplier?.supplier_name ?? '—', sub: supplier?.payment_terms ? `Terms: ${supplier.payment_terms}` : undefined, step: 0 },
                        { label: 'Items', value: `${lines.length} item${lines.length === 1 ? '' : 's'} · ${units} unit${units === 1 ? '' : 's'}`, sub: lines.slice(0, 3).map((line) => line.name).join(', ') + (lines.length > 3 ? ` +${lines.length - 3} more` : ''), step: 1 },
                        { label: 'Delivery', value: values.expectedDelivery ? `By ${formatDate(values.expectedDelivery, 'dd MMM yyyy')}` : 'No date set', sub: values.address, step: 2 },
                      ].map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{row.label}</dt>
                            <dd className="text-sm font-medium">{row.value}</dd>
                            {row.sub && <dd className="truncate text-xs text-muted-foreground">{row.sub}</dd>}
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => goTo(row.step)}>Change</Button>
                        </div>
                      ))}
                    </dl>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={control} name="shipping" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery charge</FormLabel>
                          <FormControl><Input type="number" min={0} step="0.01" inputMode="decimal" className="tabular-nums" {...field} value={Number.isNaN(field.value) ? '' : field.value} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={control} name="discount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier discount</FormLabel>
                          <FormControl><Input type="number" min={0} step="0.01" inputMode="decimal" className="tabular-nums" {...field} value={Number.isNaN(field.value) ? '' : field.value} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="space-y-1.5 rounded-lg bg-muted/40 px-4 py-3 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Items</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
                      {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">− {formatCurrency(discount)}</span></div>}
                      {shipping > 0 && <div className="flex justify-between text-muted-foreground"><span>Delivery charge</span><span className="tabular-nums">{formatCurrency(shipping)}</span></div>}
                      <div className="flex items-baseline justify-between border-t border-border pt-2">
                        <span className="font-semibold">Order total</span>
                        <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
                      </div>
                    </div>

                    {issues.length > 0 ? (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                          <RiAlertLine className="h-4 w-4" /> Before you can save
                        </p>
                        {issues.map((issue) => (
                          <div key={issue.message} className="flex items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
                            <span>{issue.message}</span>
                            <Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => goTo(issue.step)}>Fix</Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Save as draft</span> to finish it later, or <span className="font-medium text-foreground">save & approve</span> to lock it so it can be sent to the supplier.
                      </p>
                    )}
                  </StepCard>
                )}

                {/* ── Navigation — sticks to the bottom so it's always in reach ── */}
                <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-between gap-3 rounded-t-xl border-t border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <div className="flex min-w-0 items-center gap-3">
                    {step > 0 && (
                      <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={isSaving}>
                        <RiArrowLeftSLine className="mr-1.5 h-4 w-4" />
                        Back
                      </Button>
                    )}
                    <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                      {isLastStep ? `Total ${formatCurrency(total)}` : `Next: ${STEPS[step + 1].label}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" className="xl:hidden" onClick={() => setPreviewOpen(true)}>
                      <RiFileTextLine className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Preview PO</span>
                    </Button>
                    {!isLastStep ? (
                      <Button type="button" onClick={next}>
                        Continue
                        <RiArrowRightSLine className="ml-1.5 h-4 w-4" />
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="outline" disabled={isSaving} onClick={() => save(false)}>
                          {draftId ? 'Save changes' : 'Save as draft'}
                        </Button>
                        <Button type="button" disabled={isSaving} onClick={() => save(true)}>
                          {isSaving ? <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" /> : <RiShieldCheckLine className="mr-1.5 h-4 w-4" />}
                          Save & approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* ── Right column: the supplier copy as it will print, or a summary ── */}
          <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] space-y-3 overflow-y-auto xl:block">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
              {([['preview', 'PO preview'], ['summary', 'Summary']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={aside === key}
                  onClick={() => setAside(key)}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', aside === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>
            {aside === 'preview' ? (
              <PurchaseOrderPreview data={preview} company={companyProfile} />
            ) : (
              <Card>
                <CardContent className="space-y-4 px-5 py-4 text-sm">
                  {[
                    { label: 'Supplier', value: supplier?.supplier_name, empty: 'Not chosen yet', step: 0 },
                    { label: 'Items', value: lines.length ? `${lines.length} item${lines.length === 1 ? '' : 's'} · ${units} unit${units === 1 ? '' : 's'}` : undefined, empty: 'None yet', step: 1 },
                    { label: 'Expected', value: values.expectedDelivery ? formatDate(values.expectedDelivery, 'dd MMM yyyy') : undefined, empty: 'No date set', step: 0 },
                    { label: 'Deliver to', value: [values.shipTo, values.address].filter(Boolean).join(' · ') || undefined, empty: 'Not set', step: 2 },
                  ].map((row) => (
                    <button key={row.label} type="button" disabled={row.step > reached} onClick={() => goTo(row.step)} className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={cn('min-w-0 truncate text-right', row.value ? 'font-medium' : 'italic text-muted-foreground')}>{row.value ?? row.empty}</span>
                    </button>
                  ))}
                  <div className="flex items-baseline justify-between border-t border-border pt-3">
                    <span className="font-semibold">Order total</span>
                    <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}

export default PurchaseOrderWizard
