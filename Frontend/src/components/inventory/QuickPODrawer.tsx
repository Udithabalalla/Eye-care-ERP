import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiShoppingCartLine, RiBox3Line, RiTruckLine,
  RiCalendarLine, RiStickyNoteLine, RiCheckLine,
  RiMoneyDollarCircleLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/api/suppliers.api'
import { FrameVariant } from '@/types/frames.types'
import { formatCurrency } from '@/utils/formatters'

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
  onSuccess?: () => void
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export function QuickPODrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()

  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
    enabled: open,
  })
  const suppliers = suppliersData?.data ?? []

  const mutation = useMutation({
    mutationFn: async () => {
      if (!variant) throw new Error('No variant')
      if (!supplierId) throw new Error('Select a supplier')
      const qtyNum = parseInt(qty, 10)
      if (!qtyNum || qtyNum < 1) throw new Error('Enter a valid quantity')

      const effectiveCost = parseFloat(unitCost) || variant.cost_price

      return suppliersApi.createPurchaseOrder({
        supplier_id: supplierId,
        order_date: new Date().toISOString(),
        expected_delivery_date: deliveryDate ? `${deliveryDate}T00:00:00Z` : undefined,
        items: [{
          frame_variant_id: variant.variant_id,
          item_type: 'frame_variant',
          description: `${variant.frame_master_ref?.brand ?? ''} ${variant.frame_master_ref?.model_code ?? ''} — ${variant.color} (${variant.sku})`.trim(),
          quantity: qtyNum,
          unit_cost: effectiveCost,
        }],
        notes: notes ? { internal_notes: notes } : undefined,
      })
    },
    onSuccess: (po) => {
      toast.success(`PO ${po.order_number ?? po.id ?? ''} created`)
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      handleClose()
      onSuccess?.()
    },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.detail || 'Failed to create purchase order'),
  })

  const handleClose = () => {
    setQty('1')
    setUnitCost('')
    setSupplierId('')
    setDeliveryDate('')
    setNotes('')
    onClose()
  }

  if (!variant) return null

  const qtyNum = parseInt(qty, 10) || 0
  const effectiveCost = parseFloat(unitCost) || variant.cost_price
  const totalValue = qtyNum * effectiveCost

  const specs = [
    `eye ${variant.eye_size}mm`,
    variant.bridge_size ? `bridge ${variant.bridge_size}mm` : null,
    variant.temple_length ? `arm ${variant.temple_length}mm` : null,
    variant.rim_type,
  ].filter(Boolean).join(' · ')

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiShoppingCartLine className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">New Purchase Order</SheetTitle>
              <p className="text-xs text-muted-foreground">Reorder this variant. Creates a draft PO.</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">

            <Section icon={RiBox3Line} title="Variant">
              <Row label="Frame">
                {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code}
              </Row>
              <Row label="Color / Specs">
                <div className="text-right">
                  <p>{variant.color}</p>
                  <p className="text-xs text-muted-foreground font-normal">{specs}</p>
                </div>
              </Row>
              <Row label="SKU">
                <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
              </Row>
              <Row label="Current Stock">
                <span className="tabular-nums">{variant.current_stock} units</span>
              </Row>
              <Row label="Reorder Level">
                <span className="tabular-nums">{variant.reorder_level} units</span>
              </Row>
            </Section>

            <Section icon={RiTruckLine} title="Supplier *">
              <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select supplier…</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.supplier_name}{s.company_name ? ` · ${s.company_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            <Section icon={RiShoppingCartLine} title="Order Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Quantity *</label>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="1"
                    className="text-lg font-semibold h-11"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Unit Cost</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder={String(variant.cost_price)}
                  />
                  <p className="text-xs text-muted-foreground">Default: {formatCurrency(variant.cost_price)}</p>
                </div>
              </div>
            </Section>

            <Section icon={RiCalendarLine} title="Delivery">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Expected Delivery Date</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </Section>

            <Section icon={RiStickyNoteLine} title="Notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes or reference…"
              />
            </Section>

            <Section icon={RiMoneyDollarCircleLine} title="Summary">
              <Row label="Unit Cost">{formatCurrency(effectiveCost)}</Row>
              <Row label="Quantity">{qtyNum} units</Row>
              <Row label="Total Value">
                <span className="text-base font-bold">{formatCurrency(totalValue)}</span>
              </Row>
            </Section>

          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !supplierId || qtyNum < 1}
          >
            <RiCheckLine className="size-4" />
            {mutation.isPending ? 'Creating…' : 'Create Purchase Order'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
