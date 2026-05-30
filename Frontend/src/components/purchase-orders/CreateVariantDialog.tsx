import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiAlertLine, RiCheckLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { frameMastersApi, frameVariantsApi } from '@/api/frames.api'
import { FrameVariant, RIM_TYPES } from '@/types/frames.types'

const schema = z.object({
  brand: z.string().min(1, 'Required'),
  model_code: z.string().min(1, 'Required'),
  color: z.string().min(1, 'Required'),
  eye_size: z.coerce.number().int().min(30, 'Min 30mm').max(80, 'Max 80mm'),
  rim_type: z.string().default('full'),
  temple_length: z.coerce.number().int().optional(),
  cost_price: z.coerce.number().min(0, 'Required'),
  selling_price: z.coerce.number().min(0, 'Required'),
})
type FormValues = z.infer<typeof schema>

interface CreateVariantDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (variant: FrameVariant) => void
  supplierId?: string
}

export function CreateVariantDialog({ open, onClose, onSuccess, supplierId }: CreateVariantDialogProps) {
  const qc = useQueryClient()
  const [existingMasterId, setExistingMasterId] = useState<string | null>(null)
  const [masterChecked, setMasterChecked] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rim_type: 'full' },
  })

  const brand = form.watch('brand')
  const modelCode = form.watch('model_code')

  const { data: brandsData } = useQuery({
    queryKey: ['frame-master-brands'],
    queryFn: () => frameMastersApi.getBrands(),
    staleTime: 60_000,
  })

  // Debounced check: does this brand+model_code combo already exist as a frame master?
  useEffect(() => {
    if (!brand?.trim() || !modelCode?.trim()) {
      setExistingMasterId(null)
      setMasterChecked(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await frameMastersApi.getAll({ search: brand.trim(), page: 1, page_size: 100 })
        const found = res.data.find(
          (m) =>
            m.brand.toLowerCase() === brand.trim().toLowerCase() &&
            m.model_code.toLowerCase() === modelCode.trim().toLowerCase(),
        )
        setExistingMasterId(found?.frame_master_id ?? null)
        setMasterChecked(true)
      } catch {
        setMasterChecked(true)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [brand, modelCode])

  const willCreateMaster = masterChecked && !existingMasterId && !!brand?.trim() && !!modelCode?.trim()

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let masterId = existingMasterId

      if (!masterId) {
        const master = await frameMastersApi.create({
          brand: values.brand.trim(),
          model_code: values.model_code.trim(),
          frame_name: `${values.brand.trim()} ${values.model_code.trim()}`,
          category: 'optical',
          rim_type: values.rim_type,
          supplier_ids: supplierId ? [supplierId] : [],
        })
        masterId = master.frame_master_id
      }

      return frameVariantsApi.create({
        frame_master_id: masterId!,
        color: values.color.trim(),
        eye_size: values.eye_size,
        rim_type: values.rim_type,
        temple_length: values.temple_length || undefined,
        cost_price: values.cost_price,
        selling_price: values.selling_price,
        mrp: 0,
        current_stock: 0,
        reorder_level: 1,
        supplier_id: supplierId || undefined,
      })
    },
    onSuccess: (variant) => {
      toast.success(willCreateMaster ? 'Frame model & variant created' : 'Variant created')
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['frame-master-brands'] })
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['variant-picker'] })
      handleClose()
      onSuccess(variant)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create variant'),
  })

  const handleClose = () => {
    form.reset({ rim_type: 'full' })
    setExistingMasterId(null)
    setMasterChecked(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="z-[70] max-w-lg">
        <DialogHeader>
          <DialogTitle>New Frame Variant</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">

            {/* Frame Master */}
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frame Model</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Gucci" list="brand-suggestions" autoComplete="off" />
                    </FormControl>
                    <datalist id="brand-suggestions">
                      {(brandsData ?? []).map((b) => <option key={b} value={b} />)}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="model_code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Code *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 8333" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {masterChecked && brand?.trim() && modelCode?.trim() && (
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  existingMasterId
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {existingMasterId ? (
                    <><RiCheckLine className="size-4 shrink-0" /> Using existing model <strong>{brand.trim()} {modelCode.trim()}</strong></>
                  ) : (
                    <><RiAlertLine className="size-4 shrink-0" /> New frame model <strong>{brand.trim()} {modelCode.trim()}</strong> will also be created</>
                  )}
                </div>
              )}
            </div>

            {/* Variant fields */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Black" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="eye_size" render={({ field }) => (
                <FormItem>
                  <FormLabel>Eye Size (mm) *</FormLabel>
                  <FormControl><Input type="number" {...field} placeholder="52" /></FormControl>
                  <FormMessage />
                </FormItem>
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
              <FormField control={form.control} name="temple_length" render={({ field }) => (
                <FormItem>
                  <FormLabel>Arm Length (mm)</FormLabel>
                  <FormControl><Input type="number" {...field} placeholder="140" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cost_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Price *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="selling_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Price *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? 'Creating…'
                  : willCreateMaster
                    ? 'Create Model & Variant'
                    : 'Create Variant'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
