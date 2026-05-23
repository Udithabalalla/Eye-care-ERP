import { useState } from 'react'
import { RiPrinterLine, RiLoader4Line, RiBox3Line, RiQrCodeLine } from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiPrinterLine className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">Print Barcode Label</SheetTitle>
              <p className="text-xs text-muted-foreground">Choose a format and print for this variant.</p>
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
            </Section>

            <Section icon={RiQrCodeLine} title="Barcode Preview">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 p-6 bg-muted/20">
                <img
                  src={barcodeUrl}
                  alt={variant.sku}
                  className="max-h-20 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <p className="font-mono text-sm font-medium tracking-wider">{variant.sku}</p>
              </div>
            </Section>

            <Section icon={RiPrinterLine} title="Print Options">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Label Format</label>
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
                <label className="text-xs font-medium text-muted-foreground">Copies</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  className="w-24"
                />
              </div>
            </Section>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
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
