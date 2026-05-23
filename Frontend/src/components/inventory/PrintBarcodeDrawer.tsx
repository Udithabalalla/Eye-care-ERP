import { useState } from 'react'
import { RiPrinterLine, RiLoader4Line } from '@remixicon/react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
}

const LABEL_TYPES = [
  { value: 'frame_tag', label: 'Frame Tag' },
  { value: 'shelf_label', label: 'Shelf Label' },
  { value: 'sticker', label: 'Sticker' },
]

export function PrintBarcodeDrawer({ open, onClose, variant }: Props) {
  const [labelType, setLabelType] = useState('frame_tag')
  const [copies, setCopies] = useState('1')
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = async () => {
    if (!variant) return
    setIsPrinting(true)
    try {
      const blob = await frameVariantsApi.getLabelPdf(variant.variant_id, labelType)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 100)
      toast.success('Label opened for printing')
    } catch {
      toast.error('Failed to generate label')
    } finally {
      setIsPrinting(false)
    }
  }

  if (!variant) return null

  const barcodeUrl = frameVariantsApi.getBarcodeUrl(variant.variant_id)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col gap-0">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <RiPrinterLine className="size-5 text-primary" />
            Print Barcode Label
          </SheetTitle>
          <SheetDescription>
            Choose a label format and print for this variant.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="py-4 space-y-1">
          <p className="font-semibold text-sm">
            {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code} — {variant.color} / {variant.eye_size}mm
          </p>
          <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
        </div>

        <Separator />

        <div className="flex-1 py-4 space-y-6">
          {/* Barcode preview */}
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 p-4 bg-muted/20">
            <img
              src={barcodeUrl}
              alt={variant.sku}
              className="max-h-20 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="font-mono text-sm font-medium tracking-wider">{variant.sku}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Label Format</label>
            <Select value={labelType} onValueChange={setLabelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Copies</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="w-24"
            />
          </div>
        </div>

        <Separator />

        <div className="pt-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? <RiLoader4Line className="size-4 animate-spin" /> : <RiPrinterLine className="size-4" />}
            {isPrinting ? 'Opening…' : 'Print Label'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
