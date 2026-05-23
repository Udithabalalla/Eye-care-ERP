import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RiEqualizer2Line, RiSearchLine } from '@remixicon/react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { FrameVariant } from '@/types/frames.types'
import { frameVariantsApi } from '@/api/frames.api'
import { inventoryMovementsApi } from '@/api/erp.api'
import { format } from 'date-fns'
import Loading from '@/components/common/Loading'

const REASONS = [
  'Cycle count correction',
  'Damaged goods write-off',
  'Theft / loss',
  'Supplier return',
  'Opening stock entry',
  'System error correction',
  'Other',
]

export default function AdjustmentsWorkspace() {
  const qc = useQueryClient()
  const [variant, setVariant] = useState<FrameVariant | null>(null)
  const [newStock, setNewStock] = useState<string>('')
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')

  const { data: movements, isLoading } = useQuery({
    queryKey: ['inventory-movements-adj'],
    queryFn: () => inventoryMovementsApi.getAll({ page: 1, page_size: 100, movement_type: 'ADJUSTMENT' }),
    staleTime: 30_000,
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { new_stock: number; reason: string } }) =>
      frameVariantsApi.adjustStock(id, payload),
    onSuccess: (updated) => {
      toast.success(`Stock updated → ${updated.current_stock} units`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements-adj'] })
      setVariant(null); setNewStock(''); setReason('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Adjustment failed'),
  })

  const handleSubmit = () => {
    if (!variant) { toast.error('Select a variant'); return }
    const val = parseInt(newStock, 10)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid stock quantity (≥ 0)'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    adjustMutation.mutate({ id: variant.variant_id, payload: { new_stock: val, reason: reason.trim() } })
  }

  const delta = variant && newStock !== '' ? parseInt(newStock, 10) - (variant.current_stock ?? 0) : null

  const rows = (movements?.data ?? []).filter((m) => {
    const q = search.toLowerCase()
    return !q || [m.product_id, m.variant_id, m.reference_id, m.created_by].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Adjustments</h1>
        <p className="text-sm text-muted-foreground">Manually correct variant stock levels with a full audit trail.</p>
      </section>

      {/* Adjustment form */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">New Adjustment</CardTitle>
          <CardDescription>Select a variant, enter the correct physical count, and provide a reason.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Frame Variant *</label>
              <VariantPicker
                value={variant}
                onChange={(v) => { setVariant(v); setNewStock(v ? String(v.current_stock ?? 0) : '') }}
                showStock
                showPrice={false}
                placeholder="Search or scan variant…"
              />
              {variant && (
                <p className="text-xs text-muted-foreground">
                  Current stock: <span className="font-semibold text-foreground">{variant.current_stock ?? 0}</span>
                  {delta !== null && !isNaN(delta) && (
                    <span className={`ml-2 font-semibold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New Stock Count *</label>
              <Input
                type="number"
                min={0}
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                placeholder="e.g. 12"
                disabled={!variant}
                className="h-11 text-lg font-semibold"
              />
            </div>
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
          <Button onClick={handleSubmit} disabled={adjustMutation.isPending || !variant || newStock === '' || !reason}>
            <RiEqualizer2Line className="size-4" />
            {adjustMutation.isPending ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </CardContent>
      </Card>

      {/* Adjustment history */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Adjustment History</CardTitle>
              <CardDescription>All manual stock corrections recorded in the system.</CardDescription>
            </div>
            <Badge variant="secondary">{rows.length} records</Badge>
          </div>
          <div className="relative max-w-sm">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search by variant or user…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Variant / SKU</TableHead>
                    <TableHead>Qty Change</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.movement_id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{m.variant_id || m.product_id}</TableCell>
                      <TableCell>
                        <span className={`font-semibold tabular-nums ${m.quantity > 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{m.reference_id || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.created_by}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No adjustments recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
