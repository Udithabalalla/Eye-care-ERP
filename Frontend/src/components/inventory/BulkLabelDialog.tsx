import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiLoader4Line, RiPrinterLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { inventoryApi, InventoryItemKind } from '@/api/inventory.api'

export interface LabelItem {
  kind: InventoryItemKind
  id: string
  name: string
  detail?: string
  /** Suggested number of copies, e.g. the stock on hand */
  copies?: number
}

const LABEL_TYPES = [
  { value: 'frame_tag', label: 'Frame tag' },
  { value: 'shelf_label', label: 'Shelf label' },
  { value: 'sticker', label: 'Sticker' },
]

/** Print labels for several frames or products in one PDF, with copies per item */
export function BulkLabelDialog({ items, open, onClose }: { items: LabelItem[]; open: boolean; onClose: () => void }) {
  const [copies, setCopies] = useState<Record<string, number>>({})
  const [labelType, setLabelType] = useState('frame_tag')
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (open) setCopies(Object.fromEntries(items.map((item) => [`${item.kind}:${item.id}`, Math.min(Math.max(item.copies ?? 1, 1), 100)])))
  }, [open, items])

  const total = Object.values(copies).reduce((sum, n) => sum + n, 0)

  const print = async () => {
    setPrinting(true)
    try {
      const blob = await inventoryApi.printLabels(
        items.map((item) => ({ kind: item.kind, id: item.id, copies: copies[`${item.kind}:${item.id}`] ?? 1 })),
        labelType,
      )
      window.open(URL.createObjectURL(blob), '_blank')
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Could not create labels')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Print labels</DialogTitle>
          <DialogDescription>{items.length} item{items.length === 1 ? '' : 's'} · {total} label{total === 1 ? '' : 's'} in one PDF</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Label type</Label>
            <Select value={labelType} onValueChange={setLabelType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{LABEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {items.map((item) => {
              const key = `${item.kind}:${item.id}`
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">Copies</span>
                    <Input
                      type="number" min={1} max={100} className="h-8 w-20 text-right"
                      value={copies[key] ?? 1}
                      onChange={(e) => setCopies((prev) => ({ ...prev, [key]: Math.min(Math.max(Number(e.target.value) || 1, 1), 100) }))}
                      aria-label={`Copies of ${item.name}`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!items.length || printing} onClick={print} className="gap-1.5">
            {printing ? <RiLoader4Line className="size-4 animate-spin" /> : <RiPrinterLine className="size-4" />}
            Print {total} label{total === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
