/**
 * Receiving Workspace — merged GRN (PO-linked) + Quick Intake (ad-hoc) in one tabbed page.
 */
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiCheckLine, RiSaveLine, RiDeleteBinLine,
  RiDownloadLine, RiHistoryLine, RiTruckLine,
} from '@remixicon/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import toast from 'react-hot-toast'
import { goodsReceiptsApi, quickIntakesApi } from '@/api/frames.api'
import { suppliersApi } from '@/api/suppliers.api'
import { GoodsReceipt, GoodsReceiptItem, QuickIntake, FrameVariant } from '@/types/frames.types'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { SpreadsheetGrid, SpreadsheetRow, makeEmptyRow } from '@/components/frames/SpreadsheetGrid'
import { formatCurrency } from '@/utils/formatters'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'
import { format } from 'date-fns'

// ─── GRN Tab ──────────────────────────────────────────────────────────────────

interface GrnLine extends GoodsReceiptItem {
  _id: string
  variantObj?: FrameVariant
}

function makeBlankLine(): GrnLine {
  return { _id: crypto.randomUUID(), variant_id: '', sku: '', variant_label: '', expected_qty: 0, received_qty: 0, damaged_qty: 0, missing_qty: 0, extra_qty: 0, cost_price: 0 }
}

function GRNTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [lines, setLines] = useState<GrnLine[]>([makeBlankLine()])
  const [notes, setNotes] = useState('')
  const [isLoadingPO, setIsLoadingPO] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['goods-receipts', page],
    queryFn: () => goodsReceiptsApi.getAll({ page, page_size: 20 }),
  })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  })
  const suppliers = suppliersData?.data ?? []

  const { data: purchaseOrdersData } = useQuery({
    queryKey: ['purchase-orders-ordered'],
    queryFn: () => suppliersApi.getPurchaseOrders({ page_size: 200, status: 'Ordered' }),
    staleTime: 60_000,
  })
  const openPOs = purchaseOrdersData?.data ?? []

  const createMutation = useMutation({
    mutationFn: goodsReceiptsApi.create,
    onSuccess: () => {
      toast.success('GRN created')
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      closeCreate()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const commitMutation = useMutation({
    mutationFn: goodsReceiptsApi.commit,
    onSuccess: () => {
      toast.success('GRN committed — stock updated')
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Commit failed'),
  })

  const openCreate = () => { setSupplierId(''); setPoId(''); setNotes(''); setLines([makeBlankLine()]); setIsCreateOpen(true) }
  const closeCreate = () => setIsCreateOpen(false)

  const updateLine = (id: string, patch: Partial<GrnLine>) => {
    setLines((prev) => prev.map((l) => l._id === id ? { ...l, ...patch } : l))
  }

  const setVariantOnLine = (id: string, v: FrameVariant | null) => {
    updateLine(id, {
      variantObj: v ?? undefined,
      variant_id: v?.variant_id ?? '',
      sku: v?.sku ?? '',
      variant_label: v ? `${v.frame_master_ref?.brand} ${v.frame_master_ref?.model_code} / ${v.color} / ${v.eye_size}` : '',
      cost_price: v?.cost_price ?? 0,
    })
  }

  const handleLoadFromPO = async () => {
    if (!poId) { toast.error('Select a PO first'); return }
    setIsLoadingPO(true)
    try {
      const prefill = await goodsReceiptsApi.prefillFromPo(poId)
      setSupplierId(prefill.supplier_id)
      setLines(prefill.items.map((item) => ({ ...item, _id: crypto.randomUUID() })))
      toast.success(`Loaded ${prefill.items.length} line(s) from PO`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Could not load PO')
    } finally {
      setIsLoadingPO(false)
    }
  }

  const handleCreate = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    const items = lines.filter((l) => l.variant_id).map(({ _id, variantObj, ...rest }) => rest)
    if (!items.length) { toast.error('Add at least one line'); return }
    createMutation.mutate({ supplier_id: supplierId, purchase_order_id: poId || undefined, items, notes: notes || undefined })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Formal goods receipts linked to purchase orders.</p>
        <Button size="sm" onClick={openCreate}>
          <RiAddLine className="size-4" />
          New GRN
        </Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="px-0 pb-0">
          {isLoading ? <div className="p-12"><Loading /></div> : (
            <>
              <div className="overflow-x-auto px-6 pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Lines</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).map((g: GoodsReceipt) => (
                      <TableRow key={g.grn_number}>
                        <TableCell className="font-mono text-sm">{g.grn_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(g.receipt_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{suppliers.find((s) => s.id === g.supplier_id)?.supplier_name ?? g.supplier_id}</TableCell>
                        <TableCell className="tabular-nums">{g.items.length}</TableCell>
                        <TableCell>
                          <Badge variant={g.status === 'complete' ? 'default' : 'secondary'}>{g.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {g.status !== 'complete' && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => { if (confirm('Commit this GRN? Stock will be updated.')) commitMutation.mutate(g.grn_number) }}
                              disabled={commitMutation.isPending}
                            >
                              <RiCheckLine className="size-3.5" />
                              Commit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No goods receipts yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && (
                <Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} pageSize={20} onPageSizeChange={() => {}} totalItems={data.total} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create GRN Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Goods Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Supplier *</label>
                <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— select —</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.supplier_name}{s.company_name ? ` (${s.company_name})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">PO Reference (optional)</label>
                <div className="flex gap-2">
                  <Select value={poId || 'none'} onValueChange={(v) => setPoId(v === 'none' ? '' : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select open PO…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {openPOs.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.id}{po.supplier_information?.supplier_name ? ` · ${po.supplier_information.supplier_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={handleLoadFromPO} disabled={!poId || isLoadingPO}>
                    <RiDownloadLine className="size-4" />
                    {isLoadingPO ? 'Loading…' : 'Load'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="border rounded-md divide-y">
              <div className="grid grid-cols-[1fr_70px_70px_70px_90px_32px] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <span>Variant</span><span>Expected</span><span>Received</span><span>Damaged</span><span>Cost</span><span />
              </div>
              {lines.map((line) => (
                <div key={line._id} className="grid grid-cols-[1fr_70px_70px_70px_90px_32px] gap-2 px-3 py-2 items-center">
                  <VariantPicker value={line.variantObj ?? null} onChange={(v) => setVariantOnLine(line._id, v)} showStock showPrice={false} placeholder="Pick variant…" />
                  <Input type="number" min={0} value={line.expected_qty} onChange={(e) => updateLine(line._id, { expected_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} value={line.received_qty} onChange={(e) => updateLine(line._id, { received_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} value={line.damaged_qty} onChange={(e) => updateLine(line._id, { damaged_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} step={0.01} value={line.cost_price} onChange={(e) => updateLine(line._id, { cost_price: +e.target.value })} className="h-8 text-sm" />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setLines((p) => p.filter((l) => l._id !== line._id))}>✕</Button>
                </div>
              ))}
              <div className="px-3 py-2">
                <Button variant="ghost" size="sm" onClick={() => setLines((p) => [...p, makeBlankLine()])} className="gap-1 text-xs">
                  <RiAddLine className="size-3.5" /> Add line
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create GRN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Quick Intake Tab ─────────────────────────────────────────────────────────

function QuickIntakeTab() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'new' | 'history'>('new')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<SpreadsheetRow[]>([makeEmptyRow()])
  const [savedIntakeId, setSavedIntakeId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [histPage] = useState(1)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  })
  const suppliers = suppliersData?.data ?? []

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['quick-intakes', histPage],
    queryFn: () => quickIntakesApi.getAll({ page: histPage, page_size: 20 }),
    enabled: mode === 'history',
  })

  const saveDraft = useCallback(async () => {
    const validRows = rows.filter((r) => r.variant !== null)
    if (!validRows.length) { toast.error('Add at least one variant'); return }
    setIsSaving(true)
    try {
      const payload = {
        supplier_id: supplierId || undefined,
        notes: notes || undefined,
        items: validRows.map((r) => ({
          variant_id: r.variant!.variant_id,
          sku: r.variant!.sku,
          qty: r.qty,
          cost_price: r.cost_price,
        })),
      }
      if (savedIntakeId) {
        await quickIntakesApi.update(savedIntakeId, payload)
        toast.success('Draft saved')
      } else {
        const created = await quickIntakesApi.create(payload)
        setSavedIntakeId(created.intake_id)
        toast.success(`Draft ${created.intake_id} saved`)
      }
      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Failed to save draft')
    } finally { setIsSaving(false) }
  }, [rows, supplierId, notes, savedIntakeId, qc])

  const commitIntake = useCallback(async () => {
    if (!savedIntakeId) { await saveDraft(); return }
    if (!confirm(`Commit ${savedIntakeId}? This will update stock immediately and cannot be undone.`)) return
    setIsCommitting(true)
    try {
      await quickIntakesApi.commit(savedIntakeId)
      toast.success(`${savedIntakeId} committed — stock updated!`)
      setSavedIntakeId(null)
      setRows([makeEmptyRow()])
      setSupplierId('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Commit failed')
    } finally { setIsCommitting(false) }
  }, [savedIntakeId, saveDraft, qc])

  const totalQty = rows.reduce((s, r) => s + (r.variant ? r.qty : 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.variant ? r.qty * r.cost_price : 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Rapid ad-hoc stock entry. Tab between cells, Ctrl+Enter to add a row.</p>
        <div className="flex gap-2">
          <Button variant={mode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setMode('new')}>
            <RiAddLine className="size-4" />New Entry
          </Button>
          <Button variant={mode === 'history' ? 'default' : 'outline'} size="sm" onClick={() => setMode('history')}>
            <RiHistoryLine className="size-4" />History
          </Button>
        </div>
      </div>

      {mode === 'new' && (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Supplier</label>
                  <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.supplier_name}{s.company_name ? ` (${s.company_name})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Notes</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
                </div>
                {savedIntakeId && <Badge variant="outline" className="h-9 px-3 font-mono">{savedIntakeId}</Badge>}
              </div>
            </CardContent>
          </Card>

          <SpreadsheetGrid rows={rows} onChange={setRows} showCostPrice />

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-sm text-muted-foreground">
              {totalQty} pieces · {formatCurrency(totalCost)} total cost
            </div>
            <div className="flex gap-2">
              {savedIntakeId && (
                <Button variant="outline" size="sm" onClick={() => {
                  if (confirm('Discard this draft?')) {
                    quickIntakesApi.delete(savedIntakeId).then(() => {
                      setSavedIntakeId(null); setRows([makeEmptyRow()])
                      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
                      toast.success('Draft discarded')
                    })
                  }
                }}>
                  <RiDeleteBinLine className="size-4" />Discard
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={isSaving}>
                <RiSaveLine className="size-4" />
                {isSaving ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button size="sm" onClick={commitIntake} disabled={isCommitting}>
                <RiCheckLine className="size-4" />
                {isCommitting ? 'Committing…' : savedIntakeId ? 'Commit & Update Stock' : 'Save & Commit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === 'history' && (
        <Card className="border-border/60">
          <CardContent className="px-0 pb-0">
            {histLoading ? <div className="p-12"><Loading /></div> : (
              <div className="overflow-x-auto px-6 pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intake ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Lines</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(histData?.data ?? []).map((qi: QuickIntake) => (
                      <TableRow key={qi.intake_id}>
                        <TableCell className="font-mono text-sm">{qi.intake_id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(qi.intake_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm">{qi.supplier_id || '—'}</TableCell>
                        <TableCell className="tabular-nums">{qi.items.length}</TableCell>
                        <TableCell className="tabular-nums">{qi.total_qty}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(qi.total_cost)}</TableCell>
                        <TableCell>
                          <Badge variant={qi.status === 'committed' ? 'default' : 'secondary'}>{qi.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!histLoading && !histData?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No intake history yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReceivingWorkspace() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receiving</h1>
          <p className="text-sm text-muted-foreground">Receive stock from suppliers via formal GRN or quick ad-hoc intake.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RiTruckLine className="size-4" />
          <span>All receiving commits stock atomically</span>
        </div>
      </section>

      <Tabs defaultValue="grn">
        <TabsList>
          <TabsTrigger value="grn">PO Receiving (GRN)</TabsTrigger>
          <TabsTrigger value="quick">Quick Intake</TabsTrigger>
        </TabsList>
        <TabsContent value="grn" className="pt-4">
          <GRNTab />
        </TabsContent>
        <TabsContent value="quick" className="pt-4">
          <QuickIntakeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
