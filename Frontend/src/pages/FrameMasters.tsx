import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiEditLine, RiDeleteBinLine, RiEyeLine,
  RiBox3Line, RiSearchLine, RiGridLine,
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
import { frameMastersApi } from '@/api/frames.api'
import { FrameMaster, FRAME_MATERIALS, FRAME_SHAPES, RIM_TYPES, FRAME_GENDERS, FRAME_CATEGORIES } from '@/types/frames.types'
import { StockBadge } from '@/components/frames/StockBadge'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'

const schema = z.object({
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
type FormValues = z.infer<typeof schema>

export default function FrameMasters() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FrameMaster | null>(null)

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

  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: frameMastersApi.create,
    onSuccess: () => { toast.success('Frame master created'); qc.invalidateQueries({ queryKey: ['frame-masters'] }); closeModal() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormValues }) => frameMastersApi.update(id, data),
    onSuccess: () => { toast.success('Frame master updated'); qc.invalidateQueries({ queryKey: ['frame-masters'] }); closeModal() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: frameMastersApi.delete,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['frame-masters'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  const openCreate = () => {
    setEditTarget(null)
    form.reset({ category: 'optical' })
    setIsModalOpen(true)
  }

  const openEdit = (m: FrameMaster) => {
    setEditTarget(m)
    form.reset(m)
    setIsModalOpen(true)
  }

  const closeModal = () => { setIsModalOpen(false); setEditTarget(null) }

  const onSubmit = (values: FormValues) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.frame_master_id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frame Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage frame models. Variants are created per model.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <RiAddLine className="size-4" />
          New Frame Model
        </Button>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total Models</p>
              <p className="text-2xl font-bold">{data?.total ?? 0}</p>
            </div>
            <RiBox3Line className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Brands</p>
              <p className="text-2xl font-bold">{brands.length}</p>
            </div>
            <RiGridLine className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Frame Models</CardTitle>
              <CardDescription>Click a model to manage its variants.</CardDescription>
            </div>
            <Badge variant="secondary">{data?.total ?? 0} total</Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search brand, model…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={brandFilter || 'all'} onValueChange={(v) => { setBrandFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {FRAME_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
                    <TableRow>
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
                    {(data?.data ?? []).map((m) => (
                      <TableRow key={m.frame_master_id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium">{m.brand} {m.model_code}</p>
                            <p className="text-xs text-muted-foreground">{m.frame_master_id}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{m.category}</Badge></TableCell>
                        <TableCell className="capitalize text-sm">{m.material ?? '—'}</TableCell>
                        <TableCell className="capitalize text-sm">{m.gender ?? '—'}</TableCell>
                        <TableCell className="capitalize text-sm">{m.rim_type ?? '—'}</TableCell>
                        <TableCell className="text-sm tabular-nums">{m.variant_count}</TableCell>
                        <TableCell>
                          <StockBadge stock={m.total_stock} reorderLevel={0} showCount />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                                    <RiEditLine className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit model</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => { if (confirm('Delete this frame model?')) deleteMutation.mutate(m.frame_master_id) }}
                                  >
                                    <RiDeleteBinLine className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete model</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Frame Model' : 'New Frame Model'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand *</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Boss" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="model_code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Code *</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 1602" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="frame_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frame Name *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Boss 1602" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value ?? 'optical'} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FRAME_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FRAME_GENDERS.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="material" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FRAME_MATERIALS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="rim_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rim Type</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shape" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shape</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FRAME_SHAPES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="default_eye_size" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Eye Size (mm)</FormLabel>
                    <FormControl><Input type="number" {...field} placeholder="52" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input {...field} placeholder="Optional notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Model'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
