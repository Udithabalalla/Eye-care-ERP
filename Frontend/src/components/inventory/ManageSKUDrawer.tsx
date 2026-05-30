import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiBox3Line, RiArrowDownCircleLine, RiEqualizer2Line,
  RiPrinterLine, RiArrowUpDownLine, RiMoneyDollarCircleLine,
  RiLoader4Line, RiQrCodeLine, RiFileTextLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StockBadge } from '@/components/frames/StockBadge'
import { inventoryMovementsApi } from '@/api/erp.api'
import { frameVariantsApi, quickIntakesApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'
import { formatCurrency } from '@/utils/formatters'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import Loading from '@/components/common/Loading'

const ADJUST_REASONS = [
  'Cycle count correction',
  'Damaged goods write-off',
  'Theft / loss',
  'Supplier return',
  'Opening stock entry',
  'System error correction',
  'Other',
]

const LABEL_TYPES = [
  { value: 'frame_tag', label: 'Frame Tag' },
  { value: 'shelf_label', label: 'Shelf Label' },
  { value: 'sticker', label: 'Sticker' },
]

function SectionHead({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
      <Icon className="size-3.5" />
      {title}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
}

export function ManageSKUDrawer({ open, onClose, variant }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('overview')

  // Receive state
  const [receiveQty, setReceiveQty] = useState('1')
  const [receiveNotes, setReceiveNotes] = useState('')

  // Adjust state
  const [newStock, setNewStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  // Print state
  const [labelType, setLabelType] = useState('frame_tag')
  const [copies, setCopies] = useState('1')
  const [isPrinting, setIsPrinting] = useState(false)

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['variant-movements', variant?.variant_id],
    queryFn: () => inventoryMovementsApi.getAll({ product_id: variant!.variant_id, page: 1, page_size: 100 }),
    enabled: open && !!variant && tab === 'history',
    staleTime: 10_000,
  })
  const movements = movementsData?.data ?? []

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!variant) throw new Error('No variant')
      const qty = parseInt(receiveQty, 10)
      const intake = await quickIntakesApi.create({
        items: [{ variant_id: variant.variant_id, sku: variant.sku, qty, cost_price: variant.cost_price }],
        notes: receiveNotes || undefined,
      })
      await quickIntakesApi.commit(intake.intake_id)
    },
    onSuccess: () => {
      toast.success(`+${receiveQty} units received`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      setReceiveQty('1')
      setReceiveNotes('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Receive failed'),
  })

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!variant) throw new Error('No variant')
      return frameVariantsApi.adjustStock(variant.variant_id, {
        new_stock: parseInt(newStock, 10),
        reason: adjustReason,
      })
    },
    onSuccess: (updated) => {
      toast.success(`Stock adjusted → ${updated.current_stock} units`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      setNewStock('')
      setAdjustReason('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Adjustment failed'),
  })

  const handlePrint = async () => {
    if (!variant) return
    setIsPrinting(true)
    try {
      const blob = await frameVariantsApi.getLabelPdf(variant.variant_id, labelType)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        const a = document.createElement('a')
        a.href = url
        a.download = `${variant.sku}-${labelType}.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      toast.success('Label sent to printer')
    } catch {
      toast.error('Failed to generate label')
    } finally {
      setIsPrinting(false)
    }
  }

  const handleClose = () => {
    setTab('overview')
    setReceiveQty('1')
    setReceiveNotes('')
    setNewStock('')
    setAdjustReason('')
    onClose()
  }

  if (!variant) return null

  const adjustDelta = newStock !== '' ? parseInt(newStock, 10) - (variant.current_stock ?? 0) : null
  const barcodeUrl = frameVariantsApi.getBarcodeUrl(variant.variant_id)
  const receiveQtyNum = parseInt(receiveQty, 10)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[480px] overflow-hidden p-0">
        {/* Header */}
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <RiBox3Line className="size-5 text-primary" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <SheetTitle className="text-base leading-tight">
                {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">{variant.color} · {variant.eye_size}mm · {variant.rim_type}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
                <StockBadge stock={variant.current_stock} reorderLevel={variant.reorder_level} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid grid-cols-5 mx-6 mt-4 flex-shrink-0">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="receive" className="text-xs">Receive</TabsTrigger>
            <TabsTrigger value="adjust" className="text-xs">Adjust</TabsTrigger>
            <TabsTrigger value="print" className="text-xs">Print</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0 divide-y divide-border">
            <div className="px-6 py-5 space-y-3">
              <SectionHead icon={RiBox3Line} title="Variant Details" />
              <InfoRow label="Color">{variant.color}</InfoRow>
              <InfoRow label="Eye Size">{variant.eye_size}mm</InfoRow>
              {variant.bridge_size != null && <InfoRow label="Arm Length">{variant.bridge_size}mm</InfoRow>}
              {variant.temple_length != null && <InfoRow label="Temple Length">{variant.temple_length}mm</InfoRow>}
              <InfoRow label="Rim Type">
                <Badge variant="secondary" className="capitalize text-xs">{variant.rim_type}</Badge>
              </InfoRow>
              {variant.barcode && (
                <InfoRow label="Barcode">
                  <span className="font-mono text-xs">{variant.barcode}</span>
                </InfoRow>
              )}
            </div>

            <div className="px-6 py-5 space-y-3">
              <SectionHead icon={RiMoneyDollarCircleLine} title="Pricing" />
              <InfoRow label="Cost Price">{formatCurrency(variant.cost_price)}</InfoRow>
              <InfoRow label="Selling Price">
                <span className="font-bold text-primary">{formatCurrency(variant.selling_price)}</span>
              </InfoRow>
              {variant.mrp > 0 && <InfoRow label="MRP">{formatCurrency(variant.mrp)}</InfoRow>}
            </div>

            <div className="px-6 py-5 space-y-3">
              <SectionHead icon={RiArrowUpDownLine} title="Stock" />
              <InfoRow label="On Hand">
                <span className="tabular-nums font-semibold">{variant.current_stock} units</span>
              </InfoRow>
              <InfoRow label="Reorder Level">{variant.reorder_level} units</InfoRow>
            </div>

            <div className="px-6 py-5 space-y-3">
              <SectionHead icon={RiQrCodeLine} title="Barcode" />
              <div className="flex justify-center rounded-lg border border-border bg-white py-4 dark:bg-muted/10">
                <img
                  src={barcodeUrl}
                  alt="Barcode"
                  className="max-h-20 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <p className="text-center font-mono text-xs text-muted-foreground">{variant.barcode || variant.sku}</p>
            </div>
          </TabsContent>

          {/* ── Receive ── */}
          <TabsContent value="receive" className="flex flex-col flex-1 min-h-0 mt-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <SectionHead icon={RiArrowDownCircleLine} title="Receive Stock" />
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Stock</span>
                <span className="font-bold tabular-nums">{variant.current_stock} units</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quantity to Receive *</label>
                <Input
                  type="number"
                  min={1}
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(e.target.value)}
                  className="text-lg font-semibold h-11"
                  autoFocus
                />
                {receiveQtyNum > 0 && !isNaN(receiveQtyNum) && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    New total: {variant.current_stock + receiveQtyNum} units
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                <Input
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="e.g. Supplier delivery, PO reference…"
                />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => receiveMutation.mutate()}
                disabled={receiveMutation.isPending || !receiveQtyNum || receiveQtyNum <= 0 || isNaN(receiveQtyNum)}
                className="gap-2"
              >
                <RiArrowDownCircleLine className="size-4" />
                {receiveMutation.isPending ? 'Receiving…' : `Receive ${receiveQtyNum || 0} Units`}
              </Button>
            </div>
          </TabsContent>

          {/* ── Adjust ── */}
          <TabsContent value="adjust" className="flex flex-col flex-1 min-h-0 mt-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <SectionHead icon={RiEqualizer2Line} title="Adjust Stock Count" />
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Stock</span>
                <span className="font-bold tabular-nums">{variant.current_stock} units</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">New Stock Count *</label>
                <Input
                  type="number"
                  min={0}
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder={String(variant.current_stock)}
                  className="text-lg font-semibold h-11"
                  autoFocus
                />
                {adjustDelta !== null && !isNaN(adjustDelta) && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Change</span>
                    <span className={`font-semibold tabular-nums ${adjustDelta > 0 ? 'text-green-600 dark:text-green-400' : adjustDelta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {variant.current_stock} → {parseInt(newStock, 10)}
                      <span className="ml-1.5 text-xs">({adjustDelta > 0 ? '+' : ''}{adjustDelta})</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Reason *</label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                  <SelectContent>
                    {ADJUST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending || newStock === '' || isNaN(parseInt(newStock, 10)) || parseInt(newStock, 10) < 0 || !adjustReason}
                className="gap-2"
              >
                <RiEqualizer2Line className="size-4" />
                {adjustMutation.isPending ? 'Saving…' : 'Apply Adjustment'}
              </Button>
            </div>
          </TabsContent>

          {/* ── Print ── */}
          <TabsContent value="print" className="flex flex-col flex-1 min-h-0 mt-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <SectionHead icon={RiPrinterLine} title="Print Label" />
              <div className="flex justify-center rounded-xl border border-border bg-white py-6 dark:bg-muted/10">
                <img
                  src={barcodeUrl}
                  alt="Barcode"
                  className="max-h-24 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <p className="text-center font-mono text-xs text-muted-foreground">{variant.barcode || variant.sku}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Label Type</label>
                <Select value={labelType} onValueChange={setLabelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LABEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
            </div>
            <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handlePrint} disabled={isPrinting} className="gap-2">
                {isPrinting ? <RiLoader4Line className="size-4 animate-spin" /> : <RiPrinterLine className="size-4" />}
                {isPrinting ? 'Printing…' : 'Print Label'}
              </Button>
            </div>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history" className="flex-1 overflow-y-auto mt-0">
            <div className="px-6 py-5">
              <SectionHead icon={RiFileTextLine} title={`Movements${movements.length ? ` (${movements.length})` : ''}`} />
              {movementsLoading ? (
                <div className="py-12"><Loading /></div>
              ) : movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No stock movements recorded yet.</p>
              ) : (
                <div className="-mx-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.movement_id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {m.created_at ? format(new Date(m.created_at), 'dd MMM yy') : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={m.movement_type === 'PURCHASE_IN' ? 'default' : m.movement_type === 'SALE_OUT' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {m.movement_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold tabular-nums text-sm ${m.movement_type === 'SALE_OUT' ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                              {m.movement_type === 'SALE_OUT' ? '-' : '+'}{Math.abs(m.quantity)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{m.reference_id || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
