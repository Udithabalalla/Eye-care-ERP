import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiArrowDownCircleLine,
  RiBox3Line,
  RiTruckLine,
  RiStickyNoteLine,
  RiMoneyDollarCircleLine,
  RiCheckLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/api/suppliers.api'
import { quickIntakesApi } from '@/api/frames.api'
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

export function ReceiveStockDrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
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
      const created = await quickIntakesApi.create({
        supplier_id: supplierId || undefined,
        notes: notes || undefined,
        items: [{
          variant_id: variant.variant_id,
          sku: variant.sku,
          qty: parseInt(qty, 10),
          cost_price: parseFloat(cost) || variant.cost_price,
        }],
      })
      await quickIntakesApi.commit(created.intake_id)
    },
    onSuccess: () => {
      toast.success(`${qty} units received — stock updated`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
      setQty('1'); setCost(''); setSupplierId(''); setNotes('')
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Receive failed'),
  })

  const handleClose = () => {
    setQty('1'); setCost(''); setSupplierId(''); setNotes('')
    onClose()
  }

  if (!variant) return null

  const qtyNum = parseInt(qty, 10) || 0
  const newTotal = variant.current_stock + qtyNum
  const effectiveCost = parseFloat(cost) || variant.cost_price

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950">
              <RiArrowDownCircleLine className="size-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">Receive Stock</SheetTitle>
              <p className="text-xs text-muted-foreground">Stock updates immediately on confirm.</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
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

            <Section icon={RiArrowDownCircleLine} title="Receive Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Qty Received *</label>
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
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder={String(variant.cost_price)}
                  />
                  <p className="text-xs text-muted-foreground">Default: {formatCurrency(variant.cost_price)}</p>
                </div>
              </div>
              {qtyNum > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">After receiving</p>
                  <p className="font-semibold text-lg tabular-nums">
                    {variant.current_stock} + {qtyNum} ={' '}
                    <span className="text-green-600 dark:text-green-400">{newTotal} units</span>
                  </p>
                </div>
              )}
            </Section>

            <Section icon={RiTruckLine} title="Supplier">
              <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.supplier_name}{s.company_name ? ` · ${s.company_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            <Section icon={RiStickyNoteLine} title="Notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reference or notes…"
              />
            </Section>

            <Section icon={RiMoneyDollarCircleLine} title="Summary">
              <Row label="Unit Cost">{formatCurrency(effectiveCost)}</Row>
              <Row label="Total Value">{formatCurrency(effectiveCost * qtyNum)}</Row>
            </Section>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !qty || qtyNum < 1}
          >
            <RiCheckLine className="size-4" />
            {mutation.isPending ? 'Receiving…' : 'Receive Stock'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
