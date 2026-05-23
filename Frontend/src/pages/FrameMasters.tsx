import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiEditLine, RiDeleteBinLine, RiPrinterLine,
  RiSearchLine, RiQrCodeLine, RiFilterLine,
  RiArrowDownSLine, RiArrowRightSLine, RiGridLine, RiBox3Line,
  RiStackLine,
} from '@remixicon/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { frameMastersApi, frameVariantsApi } from '@/api/frames.api'
import {
  FrameMaster, FrameVariant, RIM_TYPES,
  FRAME_MATERIALS, FRAME_SHAPES, FRAME_GENDERS, FRAME_CATEGORIES,
} from '@/types/frames.types'
import { StockBadge } from '@/components/frames/StockBadge'
import { formatCurrency } from '@/utils/formatters'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'

// ─── Schemas ─────────────────────────────────────────────────────────────────

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

// ─── Variant rows sub-component (lazy-loaded per master) ─────────────────────

interface VariantRowsProps {
  master: FrameMaster
  onEditVariant: (v: FrameVariant) => void
  onDeleteVariant: (id: string) => void
  onPrintLabel: (v: FrameVariant) => void
}

function VariantRows({ master, onEditVariant, onDeleteVariant, onPrintLabel }: VariantRowsProps) {
  const { data: variants, isLoading } = useQuery({
    queryKey: ['frame-variants-for-master', master.frame_master_id],
    queryFn: () => frameVariantsApi.getForMaster(master.frame_master_id),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="bg-muted/30 py-3 pl-12 text-sm text-muted-foreground">
          Loading variants…
        </TableCell>
      </TableRow>
    )
  }

  if (!variants?.length) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="bg-muted/20 py-3 pl-12 text-sm text-muted-foreground italic">
          No variants yet — use "Add Variant" to create one.
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {variants.map((v) => (
        <TableRow key={v.variant_id} className="group bg-muted/20 hover:bg-muted/40 h-9 text-sm">
          {/* indent */}
          <TableCell className="py-1.5 pr-0 w-10">
            <div className="ml-4 h-full w-px bg-border" />
          </TableCell>
          {/* color */}
          <TableCell className="py-1.5 font-medium pl-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-border/60 bg-muted-foreground/20 shrink-0" />
              {v.color}
            </div>
          </TableCell>
          {/* category slot → empty */}
          <TableCell className="py-1.5 text-muted-foreground text-xs">—</TableCell>
          {/* material slot → eye size */}
          <TableCell className="py-1.5 tabular-nums">
            <span className="text-xs text-muted-foreground">eye </span>{v.eye_size}mm
          </TableCell>
          {/* gender slot → rim */}
          <TableCell className="py-1.5 capitalize text-sm">{v.rim_type}</TableCell>
          {/* rim slot → SKU */}
          <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">{v.sku}</TableCell>
          {/* variants# → stock */}
          <TableCell className="py-1.5">
            <StockBadge stock={v.current_stock} reorderLevel={v.reorder_level} />
          </TableCell>
          {/* stock → cost */}
          <TableCell className="py-1.5 tabular-nums text-muted-foreground text-xs">
            {formatCurrency(v.cost_price)}
          </TableCell>
          {/* actions */}
          <TableCell className="py-1.5">
            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditVariant(v)}>
                      <RiEditLine className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit variant</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onPrintLabel(v)}>
                      <RiPrinterLine className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print label</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Delete this variant?')) onDeleteVariant(v.variant_id) }}
                    >
                      <RiDeleteBinLine className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete variant</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* price visible always */}
            <span className="tabular-nums font-medium text-xs group-hover:hidden">
              {formatCurrency(v.selling_price)}
            </span>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FrameMasters() {
  const qc = useQueryClient()

  // list state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // expand / select
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null)

  // barcode scan
  const [scannerOpen, setScannerOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // master dialog
  const [masterModalOpen, setMasterModalOpen] = useState(false)
  const [editMaster, setEditMaster] = useState<FrameMaster | null>(null)

  // variant dialog
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [editVariant, setEditVariant] = useState<FrameVariant | null>(null)
  const [_variantMasterId, setVariantMasterId] = useState<string>('')

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['frame-masters', page, search, brandFilter, categoryFilter],
    queryFn: () => frameMastersApi.getAll({ page, page_size: 20, search, brand: brandFilter || undefined, category: categoryFilter || undefined }),
  })

  const { data: brandsData } = useQuery({
    queryKey: ['frame-master-brands'],
    queryFn: () => frameMastersApi.getBrands(),
    staleTime: 60_000,
  })
  const brands = brandsData ?? []

  // ─── Master mutations ──────────────────────────────────────────────────────

  const masterForm = useForm<MasterFormValues>({ resolver: zodResolver(masterSchema) })

  const createMasterMutation = useMutation({
    mutationFn: frameMastersApi.create,
    onSuccess: () => {
      toast.success('Frame model created')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      closeMasterModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateMasterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MasterFormValues }) => frameMastersApi.update(id, data),
    onSuccess: () => {
      toast.success('Frame model updated')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      closeMasterModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })

  const deleteMasterMutation = useMutation({
    mutationFn: frameMastersApi.delete,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['frame-masters'] }) },
    onError: () => toast.error('Failed to delete — remove all variants first'),
  })

  // ─── Variant mutations ─────────────────────────────────────────────────────

  const variantForm = useForm<VariantFormValues>({ resolver: zodResolver(variantSchema), defaultValues: { rim_type: 'full', reorder_level: 2 } })

  const createVariantMutation = useMutation({
    mutationFn: frameVariantsApi.create,
    onSuccess: (v) => {
      toast.success('Variant created')
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master', v.frame_master_id] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      closeVariantModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VariantFormValues> }) => frameVariantsApi.update(id, data),
    onSuccess: (v) => {
      toast.success('Variant updated')
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master', v.frame_master_id] })
      closeVariantModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) => frameVariantsApi.delete(id),
    onSuccess: () => {
      toast.success('Variant deleted')
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleRow = (id: string) => {
    const next = new Set(expandedIds)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setExpandedIds(next)
    setSelectedMasterId((prev) => (prev === id ? null : id))
  }

  const openCreateMaster = () => {
    setEditMaster(null)
    masterForm.reset({ category: 'optical' })
    setMasterModalOpen(true)
  }

  const openEditMaster = (m: FrameMaster) => {
    setEditMaster(m)
    masterForm.reset(m)
    setMasterModalOpen(true)
  }

  const closeMasterModal = () => { setMasterModalOpen(false); setEditMaster(null) }

  const onMasterSubmit = (values: MasterFormValues) => {
    if (editMaster) {
      updateMasterMutation.mutate({ id: editMaster.frame_master_id, data: values })
    } else {
      createMasterMutation.mutate(values)
    }
  }

  const openCreateVariant = (masterId: string) => {
    setEditVariant(null)
    setVariantMasterId(masterId)
    variantForm.reset({ frame_master_id: masterId, rim_type: 'full', reorder_level: 2 })
    setVariantModalOpen(true)
    // ensure row is expanded
    setExpandedIds((prev) => new Set([...prev, masterId]))
  }

  const openEditVariant = (v: FrameVariant) => {
    setEditVariant(v)
    setVariantMasterId(v.frame_master_id)
    variantForm.reset({ ...v, mrp: v.mrp ?? 0 })
    setVariantModalOpen(true)
  }

  const closeVariantModal = () => { setVariantModalOpen(false); setEditVariant(null) }

  const onVariantSubmit = (values: VariantFormValues) => {
    if (editVariant) {
      updateVariantMutation.mutate({ id: editVariant.variant_id, data: values })
    } else {
      createVariantMutation.mutate(values)
    }
  }

  const handlePrintLabel = async (v: FrameVariant) => {
    try {
      const pdf = await frameVariantsApi.getLabelPdf(v.variant_id, 'frame_tag')
      const url = URL.createObjectURL(pdf)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch { toast.error('Label error') }
  }

  const handleBarcodeScan = async (code: string) => {
    setScannerOpen(false)
    try {
      const v = await frameVariantsApi.scanLookup(code)
      setSearch(v.sku)
    } catch { toast.error(`No variant found for ${code}`) }
  }

  const handleBarcodeInput = async () => {
    if (!barcodeInput.trim()) return
    await handleBarcodeScan(barcodeInput.trim())
    setBarcodeInput('')
  }

  const selectedMaster = data?.data.find((m) => m.frame_master_id === selectedMasterId)
  const masterPending = createMasterMutation.isPending || updateMasterMutation.isPending
  const variantPending = createVariantMutation.isPending || updateVariantMutation.isPending

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frames</h1>
          <p className="text-sm text-muted-foreground">Frame models and their stockable variants in one view.</p>
        </div>
        <Button size="sm" onClick={openCreateMaster}>
          <RiAddLine className="size-4" />
          New Frame Model
        </Button>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Frame Models</p>
              <p className="text-2xl font-bold">{data?.total ?? 0}</p>
            </div>
            <RiGridLine className="w-8 h-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Brands</p>
              <p className="text-2xl font-bold">{brands.length}</p>
            </div>
            <RiBox3Line className="w-8 h-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total Variants</p>
              <p className="text-2xl font-bold">{data?.data.reduce((s, m) => s + m.variant_count, 0) ?? 0}</p>
            </div>
            <RiStackLine className="w-8 h-8 text-primary/60" />
          </CardContent>
        </Card>
      </div>

      {/* Main card */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Frame Catalog</CardTitle>
              <CardDescription>Click a row to select it — contextual actions appear in place.</CardDescription>
            </div>
            <Badge variant="secondary">{data?.total ?? 0} models</Badge>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative w-48">
              <RiQrCodeLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Scan / enter barcode…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-9 h-9"
                onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeInput() }}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setScannerOpen(true)}>
              <RiQrCodeLine className="size-4" />
            </Button>
            <div className="relative w-52">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search brand, model…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={brandFilter || 'all'} onValueChange={(v) => { setBrandFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {FRAME_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {(brandFilter || categoryFilter || search) && (
              <Button
                variant="ghost" size="sm" className="h-9 gap-1 text-xs"
                onClick={() => { setBrandFilter(''); setCategoryFilter(''); setSearch(''); setPage(1) }}
              >
                <RiFilterLine className="size-3.5" />Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-12"><Loading /></div>
          ) : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-10" />
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Rim</TableHead>
                      <TableHead>Variants</TableHead>
                      <TableHead>Total Stock</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).map((m) => {
                      const isExpanded = expandedIds.has(m.frame_master_id)
                      const isSelected = selectedMasterId === m.frame_master_id

                      return (
                        <>
                          {/* Master row */}
                          <TableRow
                            key={m.frame_master_id}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-muted/40'}`}
                            onClick={() => toggleRow(m.frame_master_id)}
                          >
                            <TableCell className="py-2 w-10">
                              {isExpanded
                                ? <RiArrowDownSLine className="size-4 text-muted-foreground" />
                                : <RiArrowRightSLine className="size-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="py-2">
                              <div>
                                <p className="font-semibold">{m.brand} {m.model_code}</p>
                                <p className="text-xs text-muted-foreground">{m.frame_name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="secondary" className="capitalize text-xs">{m.category}</Badge>
                            </TableCell>
                            <TableCell className="py-2 capitalize text-sm text-muted-foreground">{m.material ?? '—'}</TableCell>
                            <TableCell className="py-2 capitalize text-sm text-muted-foreground">{m.gender ?? '—'}</TableCell>
                            <TableCell className="py-2 capitalize text-sm text-muted-foreground">{m.rim_type ?? '—'}</TableCell>
                            <TableCell className="py-2 tabular-nums text-sm">{m.variant_count}</TableCell>
                            <TableCell className="py-2">
                              <StockBadge stock={m.total_stock} reorderLevel={0} showCount />
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {isSelected ? (
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => openCreateVariant(m.frame_master_id)}
                                  >
                                    <RiAddLine className="size-3.5" />
                                    Add Variant
                                  </Button>
                                  <Separator orientation="vertical" className="h-5" />
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEditMaster(m)}>
                                          <RiEditLine className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit model</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                          onClick={() => { if (confirm('Delete this frame model and all its variants?')) deleteMasterMutation.mutate(m.frame_master_id) }}
                                        >
                                          <RiDeleteBinLine className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete model</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">click to manage</span>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Variant rows */}
                          {isExpanded && (
                            <VariantRows
                              master={m}
                              onEditVariant={openEditVariant}
                              onDeleteVariant={(id) => deleteVariantMutation.mutate(id)}
                              onPrintLabel={handlePrintLabel}
                            />
                          )}
                        </>
                      )
                    })}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          No frame models found. Add your first model.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {data && (
                <Pagination
                  currentPage={page}
                  totalPages={data.total_pages}
                  onPageChange={setPage}
                  pageSize={20}
                  onPageSizeChange={() => {}}
                  totalItems={data.total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

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
              {!editVariant && selectedMaster && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  — {selectedMaster.brand} {selectedMaster.model_code}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit(onVariantSubmit)} className="space-y-4">
              {/* hidden master id */}
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
                  <FormItem><FormLabel>Bridge Size</FormLabel><FormControl><Input type="number" {...field} placeholder="18" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="cost_price" render={({ field }) => (
                  <FormItem><FormLabel>Cost Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="selling_price" render={({ field }) => (
                  <FormItem><FormLabel>Selling Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="current_stock" render={({ field }) => (
                  <FormItem><FormLabel>Opening Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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

      <QRScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
    </div>
  )
}
