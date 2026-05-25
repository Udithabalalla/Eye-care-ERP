import { useState } from 'react'
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
import toast from 'react-hot-toast'
import { suppliersApi } from '@/api/suppliers.api'
import { FrameVariant } from '@/types/frames.types'
import { Product } from '@/types/product.types'
import { formatCurrency } from '@/utils/formatters'

type ItemType =
  | { kind: 'variant'; item: FrameVariant }
  | { kind: 'product'; item: Product }

interface Props {
  open: boolean
  onClose: () => void
  subject: ItemType | null
  onSuccess?: () => void
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

const isoDate = (d: string) => new Date(d).toISOString()
const today = () => new Date().toISOString().slice(0, 10)

export function CreatePODrawer({ open, onClose, subject, onSuccess }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [expectedDate, setExpectedDate] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
    enabled: open,
  })
  const suppliers = suppliersData?.data ?? []

  const qtyNum = parseInt(qty, 10) || 0
  const defaultCost = subject?.kind === 'variant'
    ? subject.item.cost_price
    : subject?.kind === 'product' ? subject.item.cost_price : 0
  const effectiveCost = cost !== '' ? parseFloat(cost) : defaultCost

  const isValid = qtyNum >= 1 && effectiveCost >= 0 && !!supplierId && !!orderDate

  const resetForm = () => {
    setQty('1'); setCost(''); setSupplierId(''); setOrderDate(today())
    setExpectedDate(''); setSupplierNotes(''); setInternalNotes('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!subject) throw new Error('No item selected')
      if (qtyNum < 1) throw new Error('Quantity must be at least 1')

      const item = subject.kind === 'variant'
        ? {
            frame_variant_id: subject.item.variant_id,
            item_type: 'frame_variant' as const,
            description: `${subject.item.frame_master_ref?.brand} ${subject.item.frame_master_ref?.model_code} — ${subject.item.color} ${subject.item.eye_size}mm`,
            quantity: qtyNum,
            unit_cost: effectiveCost,
          }
        : {
            product_id: subject.item.product_id,
            item_type: 'product' as const,
            description: subject.item.name,
            quantity: qtyNum,
            unit_cost: effectiveCost,
          }

      return suppliersApi.createPurchaseOrder({
        supplier_id: supplierId,
        order_date: isoDate(orderDate),
        expected_delivery_date: expectedDate ? isoDate(expectedDate) : undefined,
        items: [item],
        notes: (supplierNotes || internalNotes)
          ? { supplier_notes: supplierNotes || undefined, internal_notes: internalNotes || undefined }
          : undefined,
      })
    },
    onSuccess: (po) => {
      toast.success(
        (t) => (
          <span className="flex items-center gap-2">
            {po.order_id} created as Draft
            <button
              className="underline font-medium"
              onClick={() => { toast.dismiss(t.id); navigate('/purchase-orders') }}
            >
              View PO
            </button>
          </span>
        ),
        { duration: 6000 }
      )
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      resetForm()
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to create PO'),
  })

  const handleClose = () => { resetForm(); onClose() }

  if (!subject) return null

  const isVariant = subject.kind === 'variant'
  const sku = isVariant ? subject.item.sku : subject.item.sku
  const currentStock = isVariant ? subject.item.current_stock : subject.item.current_stock

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
              <RiFileTextLine className="size-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div className="space-y-0.5">
              <SheetTitle className="text-base">Create Purchase Order</SheetTitle>
              <p className="text-xs text-muted-foreground">Creates a Draft PO for the selected supplier. Approve and advance it from the Purchase Orders page.</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">

            {/* Item summary */}
            <Section icon={RiBox3Line} title={isVariant ? 'Frame Variant' : 'Product'}>
              {isVariant ? (
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
                <Badge variant="outline" className="font-mono text-xs">{sku}</Badge>
              </Row>
              <Row label="Current Stock">
                <span className="tabular-nums">{currentStock} units</span>
              </Row>
            </Section>

            {/* Supplier — required */}
            <Section icon={RiTruckLine} title="Supplier">
              <FieldLabel required>Supplier</FieldLabel>
              <Select value={supplierId || ''} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.supplier_name}{s.company_name ? ` · ${s.company_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            {/* Order details */}
            <Section icon={RiCalendarLine} title="Order Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Order Date</FieldLabel>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Expected Delivery</FieldLabel>
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Qty to Order</FieldLabel>
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
                  <FieldLabel>Unit Cost</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder={String(defaultCost)}
                  />
                  <p className="text-xs text-muted-foreground">Default: {formatCurrency(defaultCost)}</p>
                </div>
              </div>
            </Section>

            {/* Notes */}
            <Section icon={RiStickyNoteLine} title="Notes">
              <div className="space-y-1.5">
                <FieldLabel>Supplier Notes</FieldLabel>
                <Input
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="Notes visible to supplier…"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Internal Notes</FieldLabel>
                <Input
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Internal reference…"
                />
              </div>
            </Section>

            {/* Summary */}
            <Section icon={RiMoneyDollarCircleLine} title="Summary">
              <Row label="Unit Cost">{formatCurrency(effectiveCost)}</Row>
              <Row label="Qty">{qtyNum} units</Row>
              <Row label="Est. Total">
                <span className="text-base font-bold">{formatCurrency(effectiveCost * qtyNum)}</span>
              </Row>
            </Section>

          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 space-y-2">
          {!supplierId && (
            <p className="text-xs text-muted-foreground text-center">Select a supplier to create the PO</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !isValid}
            >
              <RiCheckLine className="size-4" />
              {mutation.isPending ? 'Creating…' : 'Create Draft PO'}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <RiArrowRightLine className="size-3" />
            PO will open as Draft — approve and advance it from
            <button
              className="underline"
              onClick={() => navigate('/purchase-orders')}
            >
              Purchase Orders
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
