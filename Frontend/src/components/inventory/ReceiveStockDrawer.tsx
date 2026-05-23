import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiArrowDownCircleLine, RiCheckLine } from '@remixicon/react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col gap-0">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <RiArrowDownCircleLine className="size-5 text-primary" />
            Receive Stock
          </SheetTitle>
          <SheetDescription>
            Record incoming stock for this variant. Stock updates immediately on confirm.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {/* Variant summary */}
        <div className="py-4 space-y-1">
          <p className="font-semibold text-sm">
            {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code} — {variant.color} / {variant.eye_size}mm
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
            <span className="text-xs text-muted-foreground">Current stock: <strong>{variant.current_stock}</strong></span>
          </div>
        </div>

        <Separator />

        {/* Form */}
        <div className="flex-1 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Qty Received *</label>
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
              <label className="text-sm font-medium">Unit Cost</label>
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Supplier</label>
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
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional reference or notes…"
            />
          </div>

          {qty && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">After receiving:</p>
              <p className="font-semibold text-lg mt-0.5">
                {variant.current_stock} + {parseInt(qty, 10) || 0} ={' '}
                <span className="text-green-600 dark:text-green-400">
                  {variant.current_stock + (parseInt(qty, 10) || 0)} units
                </span>
              </p>
            </div>
          )}
        </div>

        <Separator />

        <div className="pt-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !qty || parseInt(qty, 10) < 1}
          >
            <RiCheckLine className="size-4" />
            {mutation.isPending ? 'Receiving…' : 'Receive Stock'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
