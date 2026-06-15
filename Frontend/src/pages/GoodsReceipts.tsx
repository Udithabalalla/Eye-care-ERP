import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiCheckLine, RiSearchLine, RiDownloadLine,
} from '@remixicon/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { goodsReceiptsApi } from '@/api/frames.api'
import { suppliersApi } from '@/api/suppliers.api'
import { GoodsReceipt, GoodsReceiptItem } from '@/types/frames.types'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { FrameVariant } from '@/types/frames.types'
import { format } from 'date-fns'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'

interface GrnLine extends GoodsReceiptItem {
  _id: string
  variantObj?: FrameVariant
}

function makeBlankLine(): GrnLine {
  return {
    _id: crypto.randomUUID(),
    variant_id: '',
    sku: '',
    variant_label: '',
    expected_qty: 0,
    received_qty: 0,
    damaged_qty: 0,
    missing_qty: 0,
    extra_qty: 0,
    cost_price: 0,
  }
}

export default function GoodsReceipts() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [poId, setPoId] = useState('')
  const [lines, setLines] = useState<GrnLine[]>([makeBlankLine()])
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['goods-receipts', page, search],
    queryFn: () => goodsReceiptsApi.getAll({ page, page_size: 20, search: search || undefined }),
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

  const [isLoadingPO, setIsLoadingPO] = useState(false)
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

  const createMutation = useMutation({
    mutationFn: goodsReceiptsApi.create,
    onSuccess: () => { toast.success('GRN created'); qc.invalidateQueries({ queryKey: ['goods-receipts'] }); closeModal() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const commitMutation = useMutation({
    mutationFn: goodsReceiptsApi.commit,
    onSuccess: () => { toast.success('GRN committed — stock updated'); qc.invalidateQueries({ queryKey: ['goods-receipts'] }); qc.invalidateQueries({ queryKey: ['frame-variants'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Commit failed'),
  })

  const openCreate = () => {
    setSupplierId(''); setPoId(''); setNotes(''); setLines([makeBlankLine()])
    setIsModalOpen(true)
  }
  const closeModal = () => setIsModalOpen(false)

  const updateLine = (id: string, patch: Partial<GrnLine>) => {
    setLines((prev) => prev.map((l) => l._id === id ? { ...l, ...patch } : l))
  }

  const setVariantOnLine = (id: string, v: FrameVariant | null) => {
    updateLine(id, {
      variantObj: v ?? undefined,
      variant_id: v?.variant_id ?? '',
      sku: v?.sku ?? '',
      variant_label: v ? `${v.frame_master_ref.brand} ${v.frame_master_ref.model_code} / ${v.color} / ${v.eye_size}` : '',
      cost_price: v?.cost_price ?? 0,
    })
  }

  const handleCreate = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    const items = lines.filter((l) => l.variant_id).map(({ _id, variantObj, ...rest }) => rest)
    if (!items.length) { toast.error('Add at least one line'); return }
    createMutation.mutate({ supplier_id: supplierId, purchase_order_id: poId || undefined, items, notes: notes || undefined })
  }

  const statusColor: Record<string, 'default' | 'secondary' | 'outline'> = {
    complete: 'default', partial: 'secondary',
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goods Receipts</h1>
          <p className="text-sm text-muted-foreground">Record received stock from suppliers (GRN).</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <RiAddLine className="size-4" />
          New GRN
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">GRN List</CardTitle>
            <Badge variant="secondary">{data?.total ?? 0} total</Badge>
          </div>
          <div className="relative max-w-sm">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search GRN…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? <div className="p-12"><Loading /></div> : (
            <>
              <div className="overflow-x-auto px-6">
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
                        <TableCell>{format(new Date(g.receipt_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{suppliers.find((s) => s.id === g.supplier_id)?.supplier_name ?? g.supplier_id}</TableCell>
                        <TableCell className="tabular-nums">{g.items.length}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor[g.status] ?? 'outline'}>{g.status}</Badge>
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
                      <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No goods receipts yet.</TableCell></TableRow>
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
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && closeModal()}>
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
                      <SelectItem key={s.id} value={s.id}>
                        {s.supplier_name}{s.company_name ? ` (${s.company_name})` : ''}
                      </SelectItem>
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
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={handleLoadFromPO}
                    disabled={!poId || isLoadingPO}
                    title="Auto-fill lines from this PO"
                  >
                    <RiDownloadLine className="size-4" />
                    {isLoadingPO ? 'Loading…' : 'Load'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="border rounded-md divide-y">
              <div className="grid grid-cols-[1fr_70px_70px_70px_90px_32px] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                <span>Variant</span><span>Expected</span><span>Received</span><span>Damaged</span><span>Cost</span><span />
              </div>
              {lines.map((line) => (
                <div key={line._id} className="grid grid-cols-[1fr_70px_70px_70px_90px_32px] gap-2 px-3 py-2 items-center">
                  <VariantPicker
                    value={line.variantObj ?? null}
                    onChange={(v) => setVariantOnLine(line._id, v)}
                    showStock showPrice={false}
                    placeholder="Pick variant…"
                  />
                  <Input type="number" min={0} value={line.expected_qty} onChange={(e) => updateLine(line._id, { expected_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} value={line.received_qty} onChange={(e) => updateLine(line._id, { received_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} value={line.damaged_qty} onChange={(e) => updateLine(line._id, { damaged_qty: +e.target.value })} className="h-8 text-center text-sm" />
                  <Input type="number" min={0} step={0.01} value={line.cost_price} onChange={(e) => updateLine(line._id, { cost_price: +e.target.value })} className="h-8 text-sm" />
                  <Button variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((l) => l._id !== line._id))} className="text-muted-foreground hover:text-destructive">
                    ✕
                  </Button>
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
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create GRN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
