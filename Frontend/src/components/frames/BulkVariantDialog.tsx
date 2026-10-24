import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiCloseLine, RiLoader4Line } from '@remixicon/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameMaster } from '@/types/frames.types'

const RIM_TYPES = ['full', 'half', 'rimless']

/** Type a value and press Enter or comma to add it as a chip */
const ChipInput = ({
  label,
  values,
  onChange,
  placeholder,
  numeric,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  numeric?: boolean
}) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(',').map((p) => p.trim()).filter(Boolean)
    const valid = numeric ? parts.filter((p) => !Number.isNaN(Number(p))) : parts
    const next = [...values]
    valid.forEach((p) => { if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p) })
    onChange(next)
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {value}
            <button type="button" onClick={() => onChange(values.filter((v) => v !== value))} aria-label={`Remove ${value}`}>
              <RiCloseLine className="size-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={draft}
          placeholder={values.length ? '' : placeholder}
          inputMode={numeric ? 'decimal' : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
            if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1))
          }}
          onBlur={add}
        />
      </div>
    </div>
  )
}

/**
 * Create every colour × size combination of a frame model in one go.
 * Stock is added afterwards with Receive, so it lands in the movement log.
 */
export function BulkVariantDialog({
  master,
  open,
  onClose,
}: {
  master: FrameMaster | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [rimType, setRimType] = useState('full')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [reorderLevel, setReorderLevel] = useState('2')

  useEffect(() => {
    if (!open || !master) return
    setColors([])
    setSizes(master.default_eye_size ? [String(master.default_eye_size)] : [])
    setRimType('full')
    setCostPrice('')
    setSellingPrice('')
    setReorderLevel('2')
  }, [open, master])

  const combos = colors.length * sizes.length

  const mutation = useMutation({
    mutationFn: () =>
      frameVariantsApi.bulkCreate({
        frame_master_id: master!.frame_master_id,
        colors,
        eye_sizes: sizes.map(Number),
        rim_type: rimType,
        bridge_size: master?.default_bridge_size,
        temple_length: master?.default_temple_length,
        cost_price: Number(costPrice || 0),
        selling_price: Number(sellingPrice || 0),
        reorder_level: Number(reorderLevel || 0),
      }),
    onSuccess: (created) => {
      toast.success(`${created.length} variant${created.length === 1 ? '' : 's'} added`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master', master?.frame_master_id] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not add variants'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add colours & sizes{master ? ` — ${master.brand} ${master.model_code}` : ''}</DialogTitle>
          <DialogDescription>Every colour is created in every size. Add stock afterwards with Receive.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ChipInput label="Colours" values={colors} onChange={setColors} placeholder="e.g. Black, Tortoise, Blue — press Enter after each" />
          <ChipInput label="Eye sizes (mm)" values={sizes} onChange={setSizes} placeholder="e.g. 50, 52, 54" numeric />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Rim type</Label>
              <Select value={rimType} onValueChange={setRimType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cost price</Label>
              <Input type="number" min={0} step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Selling price</Label>
              <Input type="number" min={0} step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder at</Label>
              <Input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
            </div>
          </div>
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {combos
              ? <>This creates <span className="font-semibold text-foreground">{combos} variant{combos === 1 ? '' : 's'}</span> ({colors.length} colour{colors.length === 1 ? '' : 's'} × {sizes.length} size{sizes.length === 1 ? '' : 's'}). Existing combinations are skipped.</>
              : 'Add at least one colour and one size.'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!combos || !Number(sellingPrice) || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <RiLoader4Line className="mr-1.5 size-4 animate-spin" />}
            Add {combos || ''} variant{combos === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
