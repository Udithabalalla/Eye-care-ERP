import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RiEqualizer2Line, RiBox3Line, RiFileTextLine } from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'
import { DrawerLabel, Row, Section } from './drawerForm'
import { toQty, wholeNumber } from './drawerFormSchema'

const REASONS = [
  'Cycle count correction',
  'Damaged goods write-off',
  'Theft / loss',
  'Supplier return',
  'Opening stock entry',
  'System error correction',
  'Other',
]

const adjustSchema = z.object({
  new_stock: wholeNumber(0, 'Enter the counted stock (0 or more)'),
  reason: z.string().min(1, 'Choose a reason'),
})
type AdjustValues = z.infer<typeof adjustSchema>
const emptyAdjust: AdjustValues = { new_stock: '', reason: '' }

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
  onSuccess?: () => void
}

export function AdjustStockDrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()
  const form = useForm<AdjustValues>({ resolver: zodResolver(adjustSchema), defaultValues: emptyAdjust, mode: 'onChange' })

  const mutation = useMutation({
    mutationFn: (values: AdjustValues) => {
      if (!variant) throw new Error('No variant')
      return frameVariantsApi.adjustStock(variant.variant_id, {
        new_stock: toQty(values.new_stock),
        reason: values.reason,
      })
    },
    onSuccess: (updated) => {
      toast.success(`Stock adjusted → ${updated.current_stock} units`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements-adj'] })
      form.reset(emptyAdjust)
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Adjustment failed'),
  })

  const handleClose = () => { form.reset(emptyAdjust); onClose() }

  const newStock = form.watch('new_stock')
  const delta = variant && /^\d+$/.test(newStock.trim()) ? toQty(newStock) - (variant.current_stock ?? 0) : null

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="flex-shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-3 pr-20">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiEqualizer2Line className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">Adjust Stock</SheetTitle>
              <p className="text-xs text-muted-foreground">Set the correct physical count. The difference is logged automatically.</p>
            </div>
          </div>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex min-h-0 flex-1 flex-col">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="divide-y divide-border">
                <Section icon={RiBox3Line} title="Variant">
                  <Row label="Frame">
                    {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code}
                  </Row>
                  <Row label="Variant">{variant.color} / {variant.eye_size}mm</Row>
                  <Row label="SKU">
                    <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
                  </Row>
                  <Row label="Current Stock">
                    <span className="tabular-nums">{variant.current_stock} units</span>
                  </Row>
                </Section>

                <Section icon={RiEqualizer2Line} title="New Count">
                  <FormField control={form.control} name="new_stock" render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <DrawerLabel required>New Stock Count</DrawerLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder={String(variant.current_stock ?? 0)}
                          className="h-11 text-lg font-semibold"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {delta !== null && (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <p className="mb-1 text-xs text-muted-foreground">Stock change</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {variant.current_stock} → <span>{toQty(newStock)}</span>
                        <span className={`ml-2 text-base ${delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          ({delta > 0 ? '+' : ''}{delta})
                        </span>
                      </p>
                    </div>
                  )}
                </Section>

                <Section icon={RiFileTextLine} title="Reason">
                  <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full" aria-label="Reason">
                            <SelectValue placeholder="Select a reason…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </Section>
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || !form.formState.isValid}>
                <RiEqualizer2Line className="size-4" />
                {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
