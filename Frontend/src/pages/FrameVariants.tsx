import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiEditLine, RiDeleteBinLine, RiPrinterLine,
  RiSearchLine, RiQrCodeLine, RiAlertLine, RiFilterLine,
} from '@remixicon/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { frameVariantsApi, frameMastersApi } from '@/api/frames.api'
import { FrameVariant, RIM_TYPES } from '@/types/frames.types'
import { StockBadge } from '@/components/frames/StockBadge'
import { formatCurrency } from '@/utils/formatters'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import QRScanner from '@/components/common/QRScanner'

const schema = z.object({
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
type FormValues = z.infer<typeof schema>

export default function FrameVariants() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [rimFilter, setRimFilter] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FrameVariant | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['frame-variants', page, pageSize, search, brandFilter, colorFilter, rimFilter, stockFilter],
    queryFn: () => frameVariantsApi.getAll({
      page, page_size: pageSize, search: search || undefined,
      brand: brandFilter || undefined, color: colorFilter || undefined,
      rim_type: rimFilter || undefined,
      low_stock: stockFilter === 'low',
      out_of_stock: stockFilter === 'out',
    }),
  })

  const { data: brandsData } = useQuery({
    queryKey: ['frame-master-brands'],
    queryFn: () => frameMastersApi.getBrands(),
    staleTime: 60_000,
  })

  const { data: colorsData } = useQuery({
    queryKey: ['variant-colors'],
    queryFn: () => frameVariantsApi.getColors(),
    staleTime: 60_000,
  })

  const { data: mastersData } = useQuery({
    queryKey: ['frame-masters-all'],
    queryFn: () => frameMastersApi.getAll({ page_size: 100 }),
    staleTime: 30_000,
  })

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rim_type: 'full', reorder_level: 2 } })

  const createMutation = useMutation({
    mutationFn: frameVariantsApi.create,
    onSuccess: () => { toast.success('Variant created'); qc.invalidateQueries({ queryKey: ['frame-variants'] }); closeModal() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormValues> }) => frameVariantsApi.update(id, data),
    onSuccess: () => { toast.success('Variant updated'); qc.invalidateQueries({ queryKey: ['frame-variants'] }); closeModal() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })
  const deleteMutation = useMutation({
    mutationFn: frameVariantsApi.delete,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['frame-variants'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  const openCreate = () => { setEditTarget(null); form.reset({ rim_type: 'full', reorder_level: 2 }); setIsModalOpen(true) }
  const openEdit = (v: FrameVariant) => {
    setEditTarget(v)
    form.reset({ ...v, mrp: v.mrp ?? 0 })
    setIsModalOpen(true)
  }
  const closeModal = () => { setIsModalOpen(false); setEditTarget(null) }

  const handleBarcodeScan = async (code: string) => {
    setScannerOpen(false)
    try {
      const v = await frameVariantsApi.scanLookup(code)
      setSearch(v.sku)
    } catch {
      toast.error(`No variant found for ${code}`)
    }
  }

  const handleBarcodeInput = async () => {
    if (!barcodeInput.trim()) return
    await handleBarcodeScan(barcodeInput.trim())
    setBarcodeInput('')
  }

  const onSubmit = (values: FormValues) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.variant_id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const lowStockCount = data?.data.filter((v) => v.current_stock > 0 && v.current_stock <= v.reorder_level).length ?? 0
  const outCount = data?.data.filter((v) => v.current_stock === 0).length ?? 0
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frame Inventory</h1>
          <p className="text-sm text-muted-foreground">All stockable frame variants with live stock levels.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <RiAddLine className="size-4" />
          Add Variant
        </Button>
      </section>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/60 cursor-pointer" onClick={() => setStockFilter('all')}>
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-sm text-muted-foreground">Total Variants</p><p className="text-2xl font-bold">{data?.total ?? 0}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60 cursor-pointer" onClick={() => setStockFilter('low')}>
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-amber-600">{lowStockCount}</p></div>
            <RiAlertLine className="w-8 h-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60 cursor-pointer" onClick={() => setStockFilter('out')}>
          <CardContent className="flex items-center justify-between p-5">
            <div><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-bold text-destructive">{outCount}</p></div>
            <RiAlertLine className="w-8 h-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Variant Grid</CardTitle>
              <CardDescription>Compact view — click stats cards to filter by stock level.</CardDescription>
            </div>
            <Badge variant="secondary">{data?.total ?? 0} variants</Badge>
          </div>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative w-44">
              <RiQrCodeLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Scan barcode…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-9 h-9"
                onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeInput() }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
              <RiQrCodeLine className="size-4" />
            </Button>
            <div className="relative w-52">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={brandFilter || 'all'} onValueChange={(v) => { setBrandFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {(brandsData ?? []).map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={colorFilter || 'all'} onValueChange={(v) => { setColorFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Color" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colors</SelectItem>
                {(colorsData ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rimFilter || 'all'} onValueChange={(v) => { setRimFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Rim" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rims</SelectItem>
                {RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {(brandFilter || colorFilter || rimFilter || stockFilter !== 'all' || search) && (
              <Button
                variant="ghost" size="sm" className="h-9 gap-1 text-xs"
                onClick={() => { setBrandFilter(''); setColorFilter(''); setRimFilter(''); setStockFilter('all'); setSearch(''); setPage(1) }}
              >
                <RiFilterLine className="size-3.5" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? <div className="p-12"><Loading /></div> : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Rim</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).map((v) => (
                      <TableRow key={v.variant_id} className="group text-sm h-9">
                        <TableCell className="font-medium py-1.5">
                          {v.frame_master_ref.brand} {v.frame_master_ref.model_code}
                        </TableCell>
                        <TableCell className="py-1.5">{v.color}</TableCell>
                        <TableCell className="tabular-nums py-1.5">{v.eye_size}</TableCell>
                        <TableCell className="capitalize py-1.5">{v.rim_type}</TableCell>
                        <TableCell className="font-mono text-xs py-1.5 text-muted-foreground">{v.sku}</TableCell>
                        <TableCell className="py-1.5">
                          <StockBadge stock={v.current_stock} reorderLevel={v.reorder_level} />
                        </TableCell>
                        <TableCell className="tabular-nums py-1.5 text-muted-foreground">{formatCurrency(v.cost_price)}</TableCell>
                        <TableCell className="tabular-nums font-medium py-1.5">{formatCurrency(v.selling_price)}</TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                                    <RiEditLine className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={async () => {
                                      try {
                                        const pdf = await frameVariantsApi.getLabelPdf(v.variant_id, 'frame_tag')
                                        const url = URL.createObjectURL(pdf)
                                        window.open(url, '_blank')
                                        setTimeout(() => URL.revokeObjectURL(url), 100)
                                      } catch { toast.error('Label error') }
                                    }}
                                  >
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
                                    variant="ghost" size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => { if (confirm('Delete this variant?')) deleteMutation.mutate(v.variant_id) }}
                                  >
                                    <RiDeleteBinLine className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          No variants found. Add variants from a frame model.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && (
                <Pagination
                  currentPage={page} totalPages={data.total_pages}
                  onPageChange={setPage} pageSize={pageSize}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                  totalItems={data.total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Variant' : 'New Variant'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!editTarget && (
                <FormField control={form.control} name="frame_master_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frame Model *</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select model…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(mastersData?.data ?? []).map((m) => (
                          <SelectItem key={m.frame_master_id} value={m.frame_master_id}>
                            {m.brand} {m.model_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="color" render={({ field }) => (
                  <FormItem><FormLabel>Color *</FormLabel><FormControl><Input {...field} placeholder="Black" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="eye_size" render={({ field }) => (
                  <FormItem><FormLabel>Eye Size (mm) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rim_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rim Type</FormLabel>
                    <Select value={field.value ?? 'full'} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bridge_size" render={({ field }) => (
                  <FormItem><FormLabel>Bridge Size</FormLabel><FormControl><Input type="number" {...field} placeholder="18" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cost_price" render={({ field }) => (
                  <FormItem><FormLabel>Cost Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="selling_price" render={({ field }) => (
                  <FormItem><FormLabel>Selling Price *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="current_stock" render={({ field }) => (
                  <FormItem><FormLabel>Opening Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="reorder_level" render={({ field }) => (
                  <FormItem><FormLabel>Reorder Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : editTarget ? 'Save' : 'Create'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <QRScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
    </div>
  )
}
