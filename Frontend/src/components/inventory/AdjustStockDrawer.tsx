import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RiEqualizer2Line, RiBox3Line, RiFileTextLine } from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiEqualizer2Line className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">Adjust Stock</SheetTitle>
              <p className="text-xs text-muted-foreground">Set the correct physical count. The difference is logged automatically.</p>
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

            <Section icon={RiEqualizer2Line} title="New Count">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">New Stock Count *</label>
                <Input
                  type="number"
                  min={0}
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder={String(variant.current_stock ?? 0)}
                  className="text-lg font-semibold h-11"
                  autoFocus
                />
              </div>
              {delta !== null && !isNaN(delta) && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Stock change</p>
                  <p className="font-semibold text-lg tabular-nums">
                    {variant.current_stock} →{' '}
                    <span>{parseInt(newStock, 10)}</span>
                    <span className={`ml-2 text-base ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  </p>
                </div>
              )}
            </Section>

            <Section icon={RiFileTextLine} title="Reason">
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Section>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}>
            <RiEqualizer2Line className="size-4" />
            {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
