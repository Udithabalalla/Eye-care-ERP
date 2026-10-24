import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiDeleteBinLine, RiPrinterLine,
  RiSearchLine, RiQrCodeLine, RiFilterLine, RiArrowRightSLine,
  RiArrowDownCircleLine, RiEqualizer2Line, RiCloseLine, RiShoppingCartLine, RiGlassesLine,
} from '@remixicon/react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { frameMastersApi, frameVariantsApi } from '@/api/frames.api'
import { inventoryApi } from '@/api/inventory.api'
import {
  FrameMaster, FrameVariant, RIM_TYPES,
  FRAME_MATERIALS, FRAME_SHAPES, FRAME_GENDERS, FRAME_CATEGORIES,
} from '@/types/frames.types'
import { StockBadge } from '@/components/frames/StockBadge'
import { FrameModelDrawer, FrameModelActions } from '@/components/frames/FrameModelDrawer'
import { BulkVariantDialog } from '@/components/frames/BulkVariantDialog'
import { formatCurrency } from '@/utils/formatters'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'
import { CreatePODrawer } from '@/components/inventory/CreatePODrawer'
import { ReceiveStockDrawer } from '@/components/inventory/ReceiveStockDrawer'
import { AdjustStockDrawer } from '@/components/inventory/AdjustStockDrawer'
import { VariantHistoryDrawer } from '@/components/inventory/VariantHistoryDrawer'
import { BulkLabelDialog, LabelItem } from '@/components/inventory/BulkLabelDialog'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const masterSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model_code: z.string().min(1, 'Model code is required'),
  frame_name: z.string().min(1, 'Frame name is required'),
  material: z.string().optional(),
  shape: z.string().optional(),
  rim_type: z.string().optional(),
  gender: z.string().optional(),
  category: z.string().default('optical'),
  description: z.string().optional(),
  default_eye_size: z.coerce.number().optional(),
  default_bridge_size: z.coerce.number().optional(),
  default_temple_length: z.coerce.number().optional(),
})
type MasterFormValues = z.infer<typeof masterSchema>

const variantSchema = z.object({
  frame_master_id: z.string().min(1, 'Select a frame model'),
  color: z.string().min(1, 'Color is required'),
  eye_size: z.coerce.number().min(30).max(80),
  bridge_size: z.coerce.number().optional(),
  temple_length: z.coerce.number().optional(),
  rim_type: z.string().default('full'),
  cost_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  mrp: z.coerce.number().optional(),
  current_stock: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(2),
})
type VariantFormValues = z.infer<typeof variantSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = 'models' | 'variants'
type StockFilter = 'all' | 'low' | 'out'

const PAGE_SIZE = 20

/** Compact single-choice pill group */
const Segmented = <T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; count?: number; tone?: 'warn' | 'bad' }>
  label: string
}) => (
  <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          value === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {option.label}
        {option.count !== undefined && (
          <span
            className={cn(
              'rounded-full px-1.5 text-[11px] tabular-nums',
              option.tone === 'bad' ? 'bg-destructive/10 text-destructive' : option.tone === 'warn' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground',
            )}
          >
            {option.count}
          </span>
        )}
      </button>
    ))}
  </div>
)

export default function FramesWorkspace() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('models')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  // The open model drawer, and the variant to point out in it
  const [drawerMaster, setDrawerMaster] = useState<FrameMaster | null>(null)
  const [highlightVariantId, setHighlightVariantId] = useState<string | null>(null)

  // Variants view selection
  const [selectedVariants, setSelectedVariants] = useState<Map<string, FrameVariant>>(new Map())

  // Dialogs
  const [masterModalOpen, setMasterModalOpen] = useState(false)
  const [editMaster, setEditMaster] = useState<FrameMaster | null>(null)
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [editVariant, setEditVariant] = useState<FrameVariant | null>(null)
  const [variantMaster, setVariantMaster] = useState<FrameMaster | null>(null)
  const [bulkMaster, setBulkMaster] = useState<FrameMaster | null>(null)
  const [labelItems, setLabelItems] = useState<LabelItem[] | null>(null)

  // Stock action drawers
  const [actionVariant, setActionVariant] = useState<FrameVariant | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [countOpen, setCountOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: mastersData, isLoading: isLoadingMasters } = useQuery({
    queryKey: ['frame-masters', page, search, brandFilter, categoryFilter],
    queryFn: () => frameMastersApi.getAll({ page, page_size: PAGE_SIZE, search, brand: brandFilter || undefined, category: categoryFilter || undefined }),
    enabled: view === 'models',
    placeholderData: keepPreviousData,
  })

  const { data: variantsData, isLoading: isLoadingVariants } = useQuery({
    queryKey: ['frame-variants', page, search, brandFilter, stockFilter],
    queryFn: () => frameVariantsApi.getAll({
      page,
      page_size: PAGE_SIZE,
      search: search || undefined,
      brand: brandFilter || undefined,
      low_stock: stockFilter === 'low' || undefined,
      out_of_stock: stockFilter === 'out' || undefined,
    }),
    enabled: view === 'variants',
    placeholderData: keepPreviousData,
  })

  // Totals for the tabs, independent of the current page
  const { data: modelTotal } = useQuery({
    queryKey: ['frame-masters-total'],
    queryFn: async () => (await frameMastersApi.getAll({ page: 1, page_size: 1 })).total,
    staleTime: 60_000,
  })
  const { data: variantTotal } = useQuery({
    queryKey: ['frame-variants-total'],
    queryFn: async () => (await frameVariantsApi.getAll({ page: 1, page_size: 1 })).total,
    staleTime: 60_000,
  })

  const { data: brandsData } = useQuery({
    queryKey: ['frame-master-brands'],
    queryFn: () => frameMastersApi.getBrands(),
    staleTime: 60_000,
  })
  const brands = brandsData ?? []

  // Each variant's own reorder level, across everything — drives the chips and the model flags
  const { data: lowStockData } = useQuery({
    queryKey: ['inventory-low-stock', 'frame', false],
    queryFn: () => inventoryApi.getLowStock({ kind: 'frame' }),
    staleTime: 60_000,
  })
  const attention = useMemo(() => {
    const byMaster = new Map<string, { low: number; out: number }>()
    let out = 0
    for (const row of lowStockData?.data ?? []) {
      if (row.out_of_stock) out += 1
      if (!row.frame_master_id) continue
      const entry = byMaster.get(row.frame_master_id) ?? { low: 0, out: 0 }
      if (row.out_of_stock) entry.out += 1
      else entry.low += 1
      byMaster.set(row.frame_master_id, entry)
    }
    return { byMaster, out, total: lowStockData?.total ?? 0 }
  }, [lowStockData])

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const refreshStock = () => {
    qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
    qc.invalidateQueries({ queryKey: ['frame-variants'] })
    qc.invalidateQueries({ queryKey: ['frame-masters'] })
    qc.invalidateQueries({ queryKey: ['inventory-low-stock'] })
  }

  const masterForm = useForm<MasterFormValues>({ resolver: zodResolver(masterSchema) })

  const createMasterMutation = useMutation({
    mutationFn: frameMastersApi.create,
    onSuccess: (m) => {
      toast.success('Frame model created')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['frame-masters-total'] })
      closeMasterModal()
      // Straight on to adding its colours & sizes
      setDrawerMaster(m)
      setBulkMaster(m)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateMasterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MasterFormValues }) => frameMastersApi.update(id, data),
    onSuccess: (m) => {
      toast.success('Frame model updated')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      if (drawerMaster?.frame_master_id === m.frame_master_id) setDrawerMaster(m)
      closeMasterModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })

  const deleteMasterMutation = useMutation({
    mutationFn: frameMastersApi.delete,
    onSuccess: () => {
      toast.success('Frame model deleted')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['frame-masters-total'] })
      setDrawerMaster(null)
    },
    onError: () => toast.error('Failed to delete — remove all variants first'),
  })

  const variantForm = useForm<VariantFormValues>({ resolver: zodResolver(variantSchema), defaultValues: { rim_type: 'full', reorder_level: 2 } })

  const createVariantMutation = useMutation({
    mutationFn: frameVariantsApi.create,
    onSuccess: () => {
      toast.success('Variant created')
      refreshStock()
      qc.invalidateQueries({ queryKey: ['frame-variants-total'] })
      closeVariantModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VariantFormValues> }) => frameVariantsApi.update(id, data),
    onSuccess: () => {
      toast.success('Variant updated')
      refreshStock()
      closeVariantModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) => frameVariantsApi.delete(id),
    onSuccess: () => {
      toast.success('Variant deleted')
      refreshStock()
      qc.invalidateQueries({ queryKey: ['frame-variants-total'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openModel = (m: FrameMaster, variantId: string | null = null) => {
    setDrawerMaster(m)
    setHighlightVariantId(variantId)
  }

  // Variants know their model by id only; fetch it (cached) and open its drawer on that variant
  const openVariantModel = async (v: FrameVariant) => {
    try {
      const m = await qc.fetchQuery({
        queryKey: ['frame-master', v.frame_master_id],
        queryFn: () => frameMastersApi.getById(v.frame_master_id),
        staleTime: 60_000,
      })
      openModel(m, v.variant_id)
    } catch {
      toast.error('Could not open this frame model')
    }
  }

  const handleBarcodeScan = async (code: string) => {
    setScannerOpen(false)
    try {
      await openVariantModel(await frameVariantsApi.scanLookup(code))
    } catch {
      toast.error(`No frame found for ${code}`)
    }
  }

  const changeView = (next: View) => {
    setView(next)
    setPage(1)
    setSelectedVariants(new Map())
    if (next === 'models') setStockFilter('all')
  }

  // Stock filters are about colours/sizes, so they always show the variants view
  const changeStockFilter = (next: StockFilter) => {
    setStockFilter(next)
    setPage(1)
    setSelectedVariants(new Map())
    if (next !== 'all') setView('variants')
  }

  const toggleVariantSelect = (v: FrameVariant) =>
    setSelectedVariants((prev) => {
      const next = new Map(prev)
      if (next.has(v.variant_id)) next.delete(v.variant_id)
      else next.set(v.variant_id, v)
      return next
    })
  const clearVariantSelection = () => setSelectedVariants(new Map())
  const singleSelected = selectedVariants.size === 1 ? [...selectedVariants.values()][0] : null

  const openCreateMaster = () => { setEditMaster(null); masterForm.reset({ category: 'optical' }); setMasterModalOpen(true) }
  const openEditMaster = (m: FrameMaster) => { setEditMaster(m); masterForm.reset(m); setMasterModalOpen(true) }
  const closeMasterModal = () => { setMasterModalOpen(false); setEditMaster(null) }
  const onMasterSubmit = (values: MasterFormValues) => {
    if (editMaster) updateMasterMutation.mutate({ id: editMaster.frame_master_id, data: values })
    else createMasterMutation.mutate(values)
  }

  const openCreateVariant = (m: FrameMaster) => {
    setEditVariant(null)
    setVariantMaster(m)
    variantForm.reset({ frame_master_id: m.frame_master_id, rim_type: m.rim_type || 'full', eye_size: m.default_eye_size, reorder_level: 2 })
    setVariantModalOpen(true)
  }
  const openEditVariant = (v: FrameVariant) => { setEditVariant(v); variantForm.reset({ ...v, mrp: v.mrp ?? 0 }); setVariantModalOpen(true) }
  const closeVariantModal = () => { setVariantModalOpen(false); setEditVariant(null); setVariantMaster(null) }
  const onVariantSubmit = (values: VariantFormValues) => {
    if (editVariant) updateVariantMutation.mutate({ id: editVariant.variant_id, data: values })
    else createVariantMutation.mutate(values)
  }

  const runAction = (v: FrameVariant, open: (value: boolean) => void) => { setActionVariant(v); open(true) }
  const labelItemsFor = (variants: FrameVariant[]): LabelItem[] =>
    variants.map((v) => ({
      kind: 'frame',
      id: v.variant_id,
      name: `${v.frame_master_ref.brand} ${v.frame_master_ref.model_code}`,
      detail: `${v.color} · ${v.eye_size} · ${v.sku}`,
      copies: Math.max(v.current_stock, 1),
    }))

  const modelActions: FrameModelActions = {
    onReceive: (v) => runAction(v, setReceiveOpen),
    onCount: (v) => runAction(v, setCountOpen),
    onReorder: (v) => runAction(v, setReorderOpen),
    onHistory: (v) => runAction(v, setHistoryOpen),
    onEditVariant: openEditVariant,
    onDeleteVariant: (v) => { if (confirm(`Delete ${v.color} ${v.eye_size}mm (${v.sku})?`)) deleteVariantMutation.mutate(v.variant_id) },
    onPrintLabels: (variants) => setLabelItems(labelItemsFor(variants)),
    onAddVariants: setBulkMaster,
    onAddOne: openCreateVariant,
    onEditModel: openEditMaster,
    onDeleteModel: (m) => { if (confirm(`Delete ${m.brand} ${m.model_code}? Remove its variants first.`)) deleteMasterMutation.mutate(m.frame_master_id) },
  }

  const masterPending = createMasterMutation.isPending || updateMasterMutation.isPending
  const variantPending = createVariantMutation.isPending || updateVariantMutation.isPending
  const listData = view === 'models' ? mastersData : variantsData
  const isLoading = view === 'models' ? isLoadingMasters : isLoadingVariants
  const hasFilters = !!(search || brandFilter || categoryFilter || stockFilter !== 'all')

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frames</h1>
          <p className="text-sm text-muted-foreground">Frame models and the colours/sizes you stock. Click a model to manage its variants.</p>
        </div>
        <Button size="sm" onClick={openCreateMaster}>
          <RiAddLine className="size-4" />
          New frame model
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-3">
          {/* What you're looking at, and what needs attention */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="View"
                value={view}
                onChange={changeView}
                options={[
                  { value: 'models', label: 'Models', count: modelTotal },
                  { value: 'variants', label: 'Colours & sizes', count: variantTotal },
                ]}
              />
              <Segmented
                label="Stock"
                value={stockFilter}
                onChange={changeStockFilter}
                options={[
                  { value: 'all', label: 'All stock' },
                  { value: 'low', label: 'Needs reorder', count: attention.total, tone: attention.total ? 'warn' : undefined },
                  { value: 'out', label: 'Out of stock', count: attention.out, tone: attention.out ? 'bad' : undefined },
                ]}
              />
            </div>
            {attention.total > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/inventory/reorder?kind=frame')}>
                <RiShoppingCartLine className="size-4" />
                Reorder {attention.total}
              </Button>
            )}
          </div>

          {/* Find */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-80">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={view === 'models' ? 'Search brand, model or SKU…' : 'Search colour, SKU, brand…'}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="h-9 pl-9 pr-10"
              />
              <Button
                variant="ghost" size="sm" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => setScannerOpen(true)} aria-label="Scan a barcode" title="Scan a barcode"
              >
                <RiQrCodeLine className="size-4" />
              </Button>
            </div>
            <Select value={brandFilter || 'all'} onValueChange={(v) => { setBrandFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {view === 'models' && (
              <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {FRAME_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button
                variant="ghost" size="sm" className="h-9 gap-1 text-xs"
                onClick={() => { setBrandFilter(''); setCategoryFilter(''); setSearch(''); setStockFilter('all'); setPage(1) }}
              >
                <RiFilterLine className="size-3.5" />Clear filters
              </Button>
            )}
            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{listData?.total ?? 0} {view === 'models' ? 'models' : 'variants'}</span>
          </div>

          {/* Selection bar (variants view) */}
          {view === 'variants' && selectedVariants.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
              <span className="mr-1 text-sm font-medium text-primary">{selectedVariants.size} selected</span>
              {singleSelected && (
                <>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => runAction(singleSelected, setReceiveOpen)}>
                    <RiArrowDownCircleLine className="size-3.5" />Receive
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => runAction(singleSelected, setCountOpen)}>
                    <RiEqualizer2Line className="size-3.5" />Count
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => runAction(singleSelected, setReorderOpen)}>
                    <RiShoppingCartLine className="size-3.5" />Reorder
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLabelItems(labelItemsFor([...selectedVariants.values()]))}>
                <RiPrinterLine className="size-3.5" />Print labels
              </Button>
              <Button
                variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  const ids = [...selectedVariants.keys()]
                  if (confirm(`Delete ${ids.length} variant${ids.length > 1 ? 's' : ''}?`)) {
                    ids.forEach((id) => deleteVariantMutation.mutate(id))
                    clearVariantSelection()
                  }
                }}
              >
                <RiDeleteBinLine className="size-3.5" />Delete
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0" onClick={clearVariantSelection} aria-label="Clear selection">
                <RiCloseLine className="size-4" />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16"><Loading /></div>
          ) : !listData?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RiGlassesLine className="mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">{hasFilters ? 'Nothing matches these filters' : 'No frames yet'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasFilters ? 'Try clearing a filter.' : 'Add your first frame model, then its colours and sizes.'}
              </p>
              {!hasFilters && (
                <Button size="sm" className="mt-4" onClick={openCreateMaster}><RiAddLine className="size-4" />New frame model</Button>
              )}
            </div>
          ) : view === 'models' ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Model</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                  <TableHead className="text-right">Variants</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead>Attention</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mastersData?.data ?? []).map((m) => {
                  const flags = attention.byMaster.get(m.frame_master_id)
                  const isActive = drawerMaster?.frame_master_id === m.frame_master_id
                  return (
                    <TableRow
                      key={m.frame_master_id}
                      data-keeps-drawer-open=""
                      onClick={() => openModel(m)}
                      className={cn('cursor-pointer', isActive && 'bg-primary/5 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10')}
                    >
                      <TableCell className="pl-6">
                        <p className="font-medium">{m.brand} <span className="font-normal">{m.model_code}</span></p>
                        {m.frame_name && m.frame_name !== `${m.brand} ${m.model_code}` && (
                          <p className="text-xs text-muted-foreground">{m.frame_name}</p>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{m.category}</Badge></TableCell>
                      <TableCell className="hidden text-sm capitalize text-muted-foreground lg:table-cell">
                        {[m.shape, m.material, m.rim_type].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.variant_count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{m.total_stock}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {flags?.out ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{flags.out} out</span> : null}
                          {flags?.low ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{flags.low} low</span> : null}
                          {!flags && m.variant_count === 0 && <span className="text-xs text-muted-foreground">No variants</span>}
                          {!flags && m.variant_count > 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right"><RiArrowRightSLine className="ml-auto size-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={(variantsData?.data ?? []).length > 0 && (variantsData?.data ?? []).every((v) => selectedVariants.has(v.variant_id))}
                      onCheckedChange={(checked) => setSelectedVariants(checked ? new Map((variantsData?.data ?? []).map((v) => [v.variant_id, v])) : new Map())}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                  <TableHead>Frame</TableHead>
                  <TableHead>Colour · size</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(variantsData?.data ?? []).map((v) => {
                  const isActive = highlightVariantId === v.variant_id && !!drawerMaster
                  return (
                    <TableRow
                      key={v.variant_id}
                      data-keeps-drawer-open=""
                      data-state={selectedVariants.has(v.variant_id) ? 'selected' : undefined}
                      onClick={() => openVariantModel(v)}
                      className={cn('cursor-pointer', isActive && 'bg-primary/5 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10')}
                    >
                      <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedVariants.has(v.variant_id)} onCheckedChange={() => toggleVariantSelect(v)} aria-label={`Select ${v.sku}`} />
                      </TableCell>
                      <TableCell className="font-medium">{v.frame_master_ref.brand} {v.frame_master_ref.model_code}</TableCell>
                      <TableCell>{v.color} <span className="text-muted-foreground">· {v.eye_size} mm</span></TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{v.sku}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(v.selling_price)}</TableCell>
                      <TableCell><StockBadge stock={v.current_stock} reorderLevel={v.reorder_level} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {listData && listData.total_pages > 1 && (
            <div className="border-t px-4 py-3">
              <Pagination
                currentPage={page}
                totalPages={listData.total_pages}
                onPageChange={setPage}
                pageSize={PAGE_SIZE}
                onPageSizeChange={() => {}}
                totalItems={listData.total}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Model drawer ────────────────────────────────────────────────────── */}
      <FrameModelDrawer
        master={drawerMaster}
        open={!!drawerMaster}
        onOpenChange={(open) => { if (!open) { setDrawerMaster(null); setHighlightVariantId(null) } }}
        highlightVariantId={highlightVariantId}
        actions={modelActions}
      />

      {/* ── Frame Model Dialog ─────────────────────────────────────────────── */}
      <Dialog open={masterModalOpen} onOpenChange={(o) => !o && closeMasterModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMaster ? 'Edit Frame Model' : 'New Frame Model'}</DialogTitle>
          </DialogHeader>
          <Form {...masterForm}>
            <form onSubmit={masterForm.handleSubmit(onMasterSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={masterForm.control} name="brand" render={({ field }) => (
                  <FormItem><FormLabel>Brand *</FormLabel><FormControl><Input {...field} placeholder="e.g. Boss" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={masterForm.control} name="model_code" render={({ field }) => (
                  <FormItem><FormLabel>Model Code *</FormLabel><FormControl><Input {...field} placeholder="e.g. 1602" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={masterForm.control} name="frame_name" render={({ field }) => (
                <FormItem><FormLabel>Frame Name *</FormLabel><FormControl><Input {...field} placeholder="e.g. Boss 1602" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={masterForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value ?? 'optical'} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{FRAME_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={masterForm.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>{FRAME_GENDERS.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={masterForm.control} name="material" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>{FRAME_MATERIALS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={masterForm.control} name="rim_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rim Type</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>{RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={masterForm.control} name="shape" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shape</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>{FRAME_SHAPES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={masterForm.control} name="default_eye_size" render={({ field }) => (
                  <FormItem><FormLabel>Default Eye Size (mm)</FormLabel><FormControl><Input type="number" {...field} placeholder="52" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={masterForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="Optional notes" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeMasterModal}>Cancel</Button>
                <Button type="submit" disabled={masterPending}>
                  {masterPending ? 'Saving…' : editMaster ? 'Save Changes' : 'Create Model'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Variant Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={variantModalOpen} onOpenChange={(o) => !o && closeVariantModal()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editVariant ? 'Edit Variant' : 'New Variant'}
              {!editVariant && variantMaster && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  — {variantMaster.brand} {variantMaster.model_code}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit(onVariantSubmit)} className="space-y-4">
              <input type="hidden" {...variantForm.register('frame_master_id')} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={variantForm.control} name="color" render={({ field }) => (
                  <FormItem><FormLabel>Color *</FormLabel><FormControl><Input {...field} placeholder="Black" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="eye_size" render={({ field }) => (
                  <FormItem><FormLabel>Eye Size (mm) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="rim_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rim Type</FormLabel>
                    <Select value={field.value ?? 'full'} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={variantForm.control} name="bridge_size" render={({ field }) => (
                  <FormItem><FormLabel>Bridge (mm)</FormLabel><FormControl><Input type="number" {...field} placeholder="18" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="temple_length" render={({ field }) => (
                  <FormItem><FormLabel>Arm Length (mm)</FormLabel><FormControl><Input type="number" {...field} placeholder="140" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="cost_price" render={({ field }) => (
                  <FormItem><FormLabel>Cost Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="selling_price" render={({ field }) => (
                  <FormItem><FormLabel>Selling Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {/* Editing can not change stock: use Receive or Adjust so it is recorded in the movement log */}
                {!editVariant && (
                  <FormField control={variantForm.control} name="current_stock" render={({ field }) => (
                    <FormItem><FormLabel>Opening Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                <FormField control={variantForm.control} name="reorder_level" render={({ field }) => (
                  <FormItem><FormLabel>Reorder Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeVariantModal}>Cancel</Button>
                <Button type="submit" disabled={variantPending}>
                  {variantPending ? 'Saving…' : editVariant ? 'Save Changes' : 'Create Variant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Stock actions (open over the model drawer) ─────────────────────── */}
      <ReceiveStockDrawer
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        variant={actionVariant}
        onSuccess={refreshStock}
      />
      <AdjustStockDrawer
        open={countOpen}
        onClose={() => setCountOpen(false)}
        variant={actionVariant}
        onSuccess={refreshStock}
      />
      <CreatePODrawer
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        subject={actionVariant ? { kind: 'variant', item: actionVariant } : null}
      />
      <VariantHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        variant={actionVariant}
      />
      <BulkVariantDialog master={bulkMaster} open={!!bulkMaster} onClose={() => setBulkMaster(null)} />
      <BulkLabelDialog
        open={!!labelItems}
        onClose={() => { setLabelItems(null); clearVariantSelection() }}
        items={labelItems ?? []}
      />

      <QRScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
    </div>
  )
}
