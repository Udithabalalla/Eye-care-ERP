/**
 * Compact "create a frame variant on the fly" dialog, used from the PO assistant
 * when a needed variant doesn't exist yet.
 *
 * Step 1 – Pick or create a frame model (FrameMaster)
 * Step 2 – Fill variant details (color, size, prices, stock)
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { RiAddLine, RiArrowLeftSLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { frameMastersApi, frameVariantsApi } from '@/api/frames.api'
import { FrameMaster, FrameVariant, FRAME_CATEGORIES, FRAME_GENDERS, FRAME_MATERIALS, RIM_TYPES } from '@/types/frames.types'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const masterSchema = z.object({
  brand: z.string().min(1, 'Brand required'),
  model_code: z.string().min(1, 'Model code required'),
  frame_name: z.string().min(1, 'Frame name required'),
  category: z.string().default('optical'),
  gender: z.string().optional(),
  material: z.string().optional(),
})
type MasterFormValues = z.infer<typeof masterSchema>

const variantSchema = z.object({
  color: z.string().min(1, 'Color required'),
  eye_size: z.coerce.number().min(30).max(80),
  rim_type: z.string().default('full'),
  bridge_size: z.coerce.number().optional(),
  cost_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  current_stock: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(2),
})
type VariantFormValues = z.infer<typeof variantSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickAddVariantDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (variant: FrameVariant) => void
  /** Pre-select a specific master (e.g. when opened from the Frames page) */
  lockedMasterId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickAddVariantDialog({ open, onClose, onCreated, lockedMasterId }: QuickAddVariantDialogProps) {
  const qc = useQueryClient()

  // 'select-master' | 'new-master' | 'variant'
  const [step, setStep] = useState<'select-master' | 'new-master' | 'variant'>('select-master')
  const [pickedMaster, setPickedMaster] = useState<FrameMaster | null>(null)
  const [masterSearch, setMasterSearch] = useState('')

  const { data: mastersData } = useQuery({
    queryKey: ['frame-masters-all'],
    queryFn: () => frameMastersApi.getAll({ page_size: 100 }),
    staleTime: 30_000,
    enabled: open,
  })

  const masters = mastersData?.data ?? []
  const filteredMasters = masterSearch.trim()
    ? masters.filter((m) =>
        `${m.brand} ${m.model_code} ${m.frame_name}`.toLowerCase().includes(masterSearch.toLowerCase())
      )
    : masters

  // ─── Master creation ───────────────────────────────────────────────────────

  const masterForm = useForm<MasterFormValues>({
    resolver: zodResolver(masterSchema),
    defaultValues: { category: 'optical' },
  })

  const createMasterMutation = useMutation({
    mutationFn: frameMastersApi.create,
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['frame-masters-all'] })
      setPickedMaster(m)
      setStep('variant')
      toast.success(`Frame model "${m.brand} ${m.model_code}" created`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create frame model'),
  })

  // ─── Variant creation ──────────────────────────────────────────────────────

  const variantForm = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: { rim_type: 'full', current_stock: 0, reorder_level: 2 },
  })

  const createVariantMutation = useMutation({
    mutationFn: (data: VariantFormValues) =>
      frameVariantsApi.create({ ...data, frame_master_id: pickedMaster!.frame_master_id }),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['frame-variants'] })
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master', v.frame_master_id] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      toast.success(`Variant created — SKU: ${v.sku}`)
      onCreated(v)
      handleClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create variant'),
  })

  // ─── Navigation ────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('select-master')
    setPickedMaster(null)
    setMasterSearch('')
    masterForm.reset({ category: 'optical' })
    variantForm.reset({ rim_type: 'full', current_stock: 0, reorder_level: 2 })
    onClose()
  }

  const selectMaster = (m: FrameMaster) => {
    setPickedMaster(m)
    setStep('variant')
  }

  // If a master is locked from outside, skip step 1
  const lockedMaster = lockedMasterId ? masters.find((m) => m.frame_master_id === lockedMasterId) : null
  if (open && lockedMaster && !pickedMaster) {
    setPickedMaster(lockedMaster)
    setStep('variant')
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const stepTitle =
    step === 'select-master' ? 'Select Frame Model'
    : step === 'new-master'  ? 'New Frame Model'
    : `Add Variant — ${pickedMaster?.brand} ${pickedMaster?.model_code}`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {step !== 'select-master' && (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted transition-colors"
                onClick={() => { setStep('select-master'); setPickedMaster(null) }}
              >
                <RiArrowLeftSLine className="size-4" />
              </button>
            )}
            {stepTitle}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Select existing model ── */}
        {step === 'select-master' && (
          <div className="space-y-3">
            <Input
              placeholder="Search brand or model…"
              value={masterSearch}
              onChange={(e) => setMasterSearch(e.target.value)}
              autoFocus
            />

            <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filteredMasters.length === 0 ? (
                <p className="p-4 text-sm text-center text-muted-foreground">No models found.</p>
              ) : (
                filteredMasters.map((m) => (
                  <button
                    key={m.frame_master_id}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                    onClick={() => selectMaster(m)}
                  >
                    <div>
                      <span className="font-medium text-sm">{m.brand} {m.model_code}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.frame_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">{m.category}</Badge>
                      <span className="text-xs text-muted-foreground">{m.variant_count} variants</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => setStep('new-master')}
            >
              <RiAddLine className="size-4" />
              Create new frame model
            </Button>
          </div>
        )}

        {/* ── Step 2a: Create new master ── */}
        {step === 'new-master' && (
          <Form {...masterForm}>
            <form onSubmit={masterForm.handleSubmit((v) => createMasterMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={masterForm.control} name="brand" render={({ field }) => (
                  <FormItem><FormLabel>Brand *</FormLabel><FormControl><Input {...field} placeholder="Boss" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={masterForm.control} name="model_code" render={({ field }) => (
                  <FormItem><FormLabel>Model Code *</FormLabel><FormControl><Input {...field} placeholder="1602" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={masterForm.control} name="frame_name" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Frame Name *</FormLabel><FormControl><Input {...field} placeholder="Boss 1602" /></FormControl><FormMessage /></FormItem>
                )} />
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
                      <FormControl><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger></FormControl>
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setStep('select-master')}>Back</Button>
                <Button type="submit" size="sm" disabled={createMasterMutation.isPending}>
                  {createMasterMutation.isPending ? 'Creating…' : 'Create & Continue'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* ── Step 2b: Add variant ── */}
        {step === 'variant' && pickedMaster && (
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit((v) => createVariantMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={variantForm.control} name="color" render={({ field }) => (
                  <FormItem><FormLabel>Color *</FormLabel><FormControl><Input {...field} placeholder="Black" autoFocus /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={variantForm.control} name="eye_size" render={({ field }) => (
                  <FormItem><FormLabel>Eye Size (mm) *</FormLabel><FormControl><Input type="number" {...field} placeholder="52" /></FormControl><FormMessage /></FormItem>
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
                {!lockedMasterId && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setStep('select-master'); setPickedMaster(null) }}>
                    Back
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={createVariantMutation.isPending}>
                  {createVariantMutation.isPending ? 'Creating…' : 'Create Variant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
