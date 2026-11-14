import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  RiFileTextLine,
  RiBox3Line,
  RiTruckLine,
  RiStickyNoteLine,
  RiMoneyDollarCircleLine,
  RiCheckLine,
  RiCalendarLine,
  RiArrowRightLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { suppliersApi } from '@/api/suppliers.api'
import { FrameVariant } from '@/types/frames.types'
import { Product } from '@/types/product.types'
import { formatCurrency } from '@/utils/formatters'
import { DrawerLabel, Row, Section } from './drawerForm'
import { costOr, optionalAmount, toQty, today, wholeNumber } from './drawerFormSchema'

type ItemType =
  | { kind: 'variant'; item: FrameVariant }
  | { kind: 'product'; item: Product }

interface Props {
  open: boolean
  onClose: () => void
  subject: ItemType | null
  onSuccess?: () => void
}

const poSchema = z.object({
  supplier_id: z.string().min(1, 'Select a supplier'),
  order_date: z.string().min(1, 'Choose the order date'),
  expected_date: z.string(),
  qty: wholeNumber(1, 'Order at least 1'),
  cost: optionalAmount,
  supplier_notes: z.string(),
  internal_notes: z.string(),
})
type POValues = z.infer<typeof poSchema>

const poDefaults = (): POValues => ({
  supplier_id: '',
  order_date: today(),
  expected_date: '',
  qty: '1',
  cost: '',
  supplier_notes: '',
  internal_notes: '',
})

const isoDate = (d: string) => new Date(d).toISOString()

export function CreatePODrawer({ open, onClose, subject, onSuccess }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const form = useForm<POValues>({ resolver: zodResolver(poSchema), defaultValues: poDefaults(), mode: 'onChange' })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 100 }),
    staleTime: 60_000,
    enabled: open,
  })
  const suppliers = suppliersData?.data ?? []

  const defaultCost = subject?.item.cost_price ?? 0
  const values = form.watch()
  const qtyNum = toQty(values.qty)
  const effectiveCost = costOr(values.cost, defaultCost)

  const mutation = useMutation({
    mutationFn: async (v: POValues) => {
      if (!subject) throw new Error('No item selected')
      const quantity = toQty(v.qty)
      const unit_cost = costOr(v.cost, defaultCost)
      const item = subject.kind === 'variant'
        ? {
            frame_variant_id: subject.item.variant_id,
            item_type: 'frame_variant' as const,
            description: `${subject.item.frame_master_ref?.brand} ${subject.item.frame_master_ref?.model_code} — ${subject.item.color} ${subject.item.eye_size}mm`,
            quantity,
            unit_cost,
          }
        : {
            product_id: subject.item.product_id,
            item_type: 'product' as const,
            description: subject.item.name,
            quantity,
            unit_cost,
          }

      return suppliersApi.createPurchaseOrder({
        supplier_id: v.supplier_id,
        order_date: isoDate(v.order_date),
        expected_delivery_date: v.expected_date ? isoDate(v.expected_date) : undefined,
        items: [item],
        notes: (v.supplier_notes || v.internal_notes)
          ? { supplier_notes: v.supplier_notes || undefined, internal_notes: v.internal_notes || undefined }
          : undefined,
      })
    },
    onSuccess: (po) => {
      toast.success(`${po.id} created as Draft`, {
        duration: 6000,
        action: { label: 'View PO', onClick: () => navigate('/purchase-orders') },
      })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      form.reset(poDefaults())
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create PO'),
  })

  const handleClose = () => { form.reset(poDefaults()); onClose() }

  if (!subject) return null

  const isVariant = subject.kind === 'variant'

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="flex-shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-3 pr-20">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/15">
              <RiFileTextLine className="size-5 text-info" />
            </div>
            <div className="space-y-0.5">
              <SheetTitle className="text-base">Create Purchase Order</SheetTitle>
              <p className="text-xs text-muted-foreground">Creates a Draft PO for the selected supplier. Approve and advance it from the Purchase Orders page.</p>
            </div>
          </div>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex min-h-0 flex-1 flex-col">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="divide-y divide-border">
                <Section icon={RiBox3Line} title={isVariant ? 'Frame Variant' : 'Product'}>
                  {subject.kind === 'variant' ? (
                    <>
                      <Row label="Frame">
                        {subject.item.frame_master_ref?.brand} {subject.item.frame_master_ref?.model_code}
                      </Row>
                      <Row label="Variant">
                        {subject.item.color} · {subject.item.eye_size}mm · <span className="capitalize">{subject.item.rim_type}</span>
                      </Row>
                    </>
                  ) : (
                    <Row label="Name">{subject.item.name}</Row>
                  )}
                  <Row label="SKU">
                    <Badge variant="outline" className="font-mono text-xs">{subject.item.sku}</Badge>
                  </Row>
                  <Row label="Current Stock">
                    <span className="tabular-nums">{subject.item.current_stock} units</span>
                  </Row>
                </Section>

                <Section icon={RiTruckLine} title="Supplier">
                  <FormField control={form.control} name="supplier_id" render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <DrawerLabel required>Supplier</DrawerLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select supplier…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.supplier_name}{s.company_name ? ` · ${s.company_name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </Section>

                <Section icon={RiCalendarLine} title="Order Details">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="order_date" render={({ field }) => (
                      <FormItem className="gap-1.5">
                        <DrawerLabel required>Order Date</DrawerLabel>
                        <FormControl><Input type="date" className="h-9" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="expected_date" render={({ field }) => (
                      <FormItem className="gap-1.5">
                        <DrawerLabel>Expected Delivery</DrawerLabel>
                        <FormControl><Input type="date" className="h-9" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="qty" render={({ field }) => (
                      <FormItem className="gap-1.5">
                        <DrawerLabel required>Qty to Order</DrawerLabel>
                        <FormControl>
                          <Input type="number" min={1} placeholder="1" className="h-11 text-lg font-semibold" autoFocus {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cost" render={({ field }) => (
                      <FormItem className="gap-1.5">
                        <DrawerLabel>Unit Cost</DrawerLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min={0} placeholder={String(defaultCost)} {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Default: {formatCurrency(defaultCost)}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </Section>

                <Section icon={RiStickyNoteLine} title="Notes">
                  <FormField control={form.control} name="supplier_notes" render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <DrawerLabel>Supplier Notes</DrawerLabel>
                      <FormControl><Input placeholder="Notes visible to supplier…" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="internal_notes" render={({ field }) => (
                    <FormItem className="gap-1.5">
                      <DrawerLabel>Internal Notes</DrawerLabel>
                      <FormControl><Input placeholder="Internal reference…" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </Section>

                <Section icon={RiMoneyDollarCircleLine} title="Summary">
                  <Row label="Unit Cost">{formatCurrency(effectiveCost)}</Row>
                  <Row label="Qty">{qtyNum} units</Row>
                  <Row label="Est. Total">
                    <span className="text-base font-bold">{formatCurrency(effectiveCost * qtyNum)}</span>
                  </Row>
                </Section>
              </div>
            </div>

            <div className="flex-shrink-0 space-y-2 border-t px-6 py-4">
              {!values.supplier_id && (
                <p className="text-center text-xs text-muted-foreground">Select a supplier to create the PO</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending || !form.formState.isValid}>
                  <RiCheckLine className="size-4" />
                  {mutation.isPending ? 'Creating…' : 'Create Draft PO'}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <RiArrowRightLine className="size-3" />
                PO will open as Draft — approve and advance it from
                <Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground underline" onClick={() => navigate('/purchase-orders')}>
                  Purchase Orders
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
