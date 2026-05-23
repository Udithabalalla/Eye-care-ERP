/**
 * Quick Intake — spreadsheet-style daily stock entry.
 * Replaces the handwritten stock book for supplier walk-ins.
 */
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine, RiCheckLine, RiSaveLine, RiDeleteBinLine,
  RiHistoryLine,
} from '@remixicon/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from '@/components/ui/table'
import toast from 'react-hot-toast'
import { quickIntakesApi } from '@/api/frames.api'
import { suppliersApi } from '@/api/suppliers.api'
import { QuickIntake as QuickIntakeType } from '@/types/frames.types'
import { SpreadsheetGrid, SpreadsheetRow, makeEmptyRow } from '@/components/frames/SpreadsheetGrid'
import { formatCurrency } from '@/utils/formatters'
import Loading from '@/components/common/Loading'
import { format } from 'date-fns'

type Mode = 'new' | 'history'

export default function QuickIntake() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('new')

  // ─── Draft state ─────────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<SpreadsheetRow[]>([makeEmptyRow()])
  const [savedIntakeId, setSavedIntakeId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 200 }),
    staleTime: 60_000,
  })
  const suppliers = suppliersData?.data ?? []

  // ─── History ─────────────────────────────────────────────────────────────
  const [histPage] = useState(1)
  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['quick-intakes', histPage],
    queryFn: () => quickIntakesApi.getAll({ page: histPage, page_size: 20 }),
    enabled: mode === 'history',
  })

  // ─── Mutations ────────────────────────────────────────────────────────────
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
    } finally {
      setIsSaving(false)
    }
  }, [rows, supplierId, notes, savedIntakeId, qc])

  const commitIntake = useCallback(async () => {
    if (!savedIntakeId) {
      await saveDraft()
      return
    }
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
      qc.invalidateQueries({ queryKey: ['frame-variants'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Commit failed')
    } finally {
      setIsCommitting(false)
    }
  }, [savedIntakeId, saveDraft, qc])

  const totalQty = rows.reduce((s, r) => s + (r.variant ? r.qty : 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.variant ? r.qty * r.cost_price : 0), 0)

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quick Intake</h1>
          <p className="text-sm text-muted-foreground">
            Rapid stock entry for supplier walk-ins. Tab between cells, Ctrl+Enter to add a row.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('new')}
          >
            <RiAddLine className="size-4" />
            New Entry
          </Button>
          <Button
            variant={mode === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('history')}
          >
            <RiHistoryLine className="size-4" />
            History
          </Button>
        </div>
      </section>

      {mode === 'new' && (
        <div className="space-y-4">
          {/* Header row */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Supplier</label>
                  <Select value={supplierId || 'none'} onValueChange={(v) => setSupplierId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.supplier_name}{s.company_name ? ` (${s.company_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Notes</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
                </div>
                {savedIntakeId && (
                  <Badge variant="outline" className="h-9 px-3 font-mono">
                    {savedIntakeId}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Spreadsheet */}
          <SpreadsheetGrid
            rows={rows}
            onChange={setRows}
            showCostPrice
          />

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-sm text-muted-foreground">
              {totalQty} pieces · {formatCurrency(totalCost)} total cost
            </div>
            <div className="flex gap-2">
              {savedIntakeId && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    if (confirm('Discard this draft?')) {
                      quickIntakesApi.delete(savedIntakeId).then(() => {
                        setSavedIntakeId(null); setRows([makeEmptyRow()])
                        qc.invalidateQueries({ queryKey: ['quick-intakes'] })
                        toast.success('Draft discarded')
                      })
                    }
                  }}
                >
                  <RiDeleteBinLine className="size-4" />
                  Discard
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
          <CardHeader>
            <CardTitle className="text-xl">Intake History</CardTitle>
            <CardDescription>All past quick intakes.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {histLoading ? <div className="p-12"><Loading /></div> : (
              <div className="overflow-x-auto px-6">
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
                    {(histData?.data ?? []).map((qi: QuickIntakeType) => (
                      <TableRow key={qi.intake_id}>
                        <TableCell className="font-mono text-sm">{qi.intake_id}</TableCell>
                        <TableCell className="text-sm">{format(new Date(qi.intake_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm">{qi.supplier_id || '—'}</TableCell>
                        <TableCell className="tabular-nums">{qi.items.length}</TableCell>
                        <TableCell className="tabular-nums">{qi.total_qty}</TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(qi.total_cost)}</TableCell>
                        <TableCell>
                          <Badge variant={qi.status === 'committed' ? 'default' : 'secondary'}>
                            {qi.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!histLoading && !histData?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No intake history yet.
                        </TableCell>
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
