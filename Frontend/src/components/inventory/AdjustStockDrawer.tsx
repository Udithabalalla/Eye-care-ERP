import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RiEqualizer2Line } from '@remixicon/react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import toast from 'react-hot-toast'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'

const REASONS = [
  'Cycle count correction',
  'Damaged goods write-off',
  'Theft / loss',
  'Supplier return',
  'Opening stock entry',
  'System error correction',
  'Other',
]

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
  onSuccess?: () => void
}

export function AdjustStockDrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()
  const [newStock, setNewStock] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!variant) throw new Error('No variant')
      return frameVariantsApi.adjustStock(variant.variant_id, {
        new_stock: parseInt(newStock, 10),
        reason,
      })
    },
    onSuccess: (updated) => {
      toast.success(`Stock adjusted → ${updated.current_stock} units`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements-adj'] })
      setNewStock(''); setReason('')
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Adjustment failed'),
  })

  const handleClose = () => { setNewStock(''); setReason(''); onClose() }

  const delta = variant && newStock !== '' ? parseInt(newStock, 10) - (variant.current_stock ?? 0) : null
  const isValid = variant && newStock !== '' && !isNaN(parseInt(newStock, 10)) && parseInt(newStock, 10) >= 0 && reason

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col gap-0">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <RiEqualizer2Line className="size-5 text-primary" />
            Adjust Stock
          </SheetTitle>
          <SheetDescription>
            Set the correct physical stock count. The difference will be recorded as an adjustment.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="py-4 space-y-1">
          <p className="font-semibold text-sm">
            {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code} — {variant.color} / {variant.eye_size}mm
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
            <span className="text-xs text-muted-foreground">
              Current stock: <strong>{variant.current_stock}</strong>
            </span>
          </div>
        </div>

        <Separator />

        <div className="flex-1 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Stock Count *</label>
            <Input
              type="number"
              min={0}
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder={String(variant.current_stock ?? 0)}
              className="text-lg font-semibold h-11"
              autoFocus
            />
            {delta !== null && !isNaN(delta) && (
              <p className="text-xs">
                Delta:{' '}
                <span className={`font-semibold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="pt-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}>
            {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
