import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiAlertLine, RiCheckDoubleLine, RiLoader4Line, RiShoppingCartLine, RiTruckLine } from '@remixicon/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inventoryApi, InventoryItemKind, LowStockItem } from '@/api/inventory.api'
import { formatCurrency } from '@/utils/formatters'

type KindFilter = 'all' | InventoryItemKind

const keyOf = (item: LowStockItem) => `${item.kind}:${item.id}`

/** Everything at or below its reorder level, with one-click draft purchase orders per supplier */
const LowStockReorder = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [kind, setKind] = useState<KindFilter>(() => {
    const fromUrl = searchParams.get('kind')
    return fromUrl === 'frame' || fromUrl === 'product' ? fromUrl : 'all'
  })
  const [outOnly, setOutOnly] = useState(searchParams.get('filter') === 'out')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-low-stock', kind, outOnly],
    queryFn: () => inventoryApi.getLowStock({ kind: kind === 'all' ? undefined : kind, out_of_stock_only: outOnly || undefined }),
  })
  const items = useMemo(() => data?.data ?? [], [data])

  const qtyOf = (item: LowStockItem) => quantities[keyOf(item)] ?? item.suggested_qty
  const chosen = items.filter((item) => selected.has(keyOf(item)))
  const supplierCount = new Set(chosen.map((item) => item.supplier_id || '—')).size
  const noSupplier = chosen.filter((item) => !item.supplier_id).length
  const estimate = chosen.reduce((sum, item) => sum + (item.unit_cost ?? 0) * qtyOf(item), 0)
  const allSelected = items.length > 0 && items.every((item) => selected.has(keyOf(item)))

  const counts = useMemo(() => ({
    out: items.filter((item) => item.out_of_stock).length,
    low: items.filter((item) => !item.out_of_stock).length,
  }), [items])

  const reorderMutation = useMutation({
    mutationFn: () => inventoryApi.reorder(chosen.map((item) => ({ kind: item.kind, id: item.id, quantity: qtyOf(item) }))),
    onSuccess: (result) => {
      const made = result?.purchase_orders?.length ?? 0
      const skipped = result?.skipped?.length ?? 0
      if (made) toast.success(`${made} draft purchase order${made === 1 ? '' : 's'} created`)
      if (skipped) toast.error(`${skipped} item${skipped === 1 ? '' : 's'} skipped — no supplier set`)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (made) navigate('/purchase-orders?status=Draft')
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Could not create purchase orders'),
  })

  const toggle = (item: LowStockItem) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyOf(item))) next.delete(keyOf(item))
      else next.add(keyOf(item))
      return next
    })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Low Stock & Reorder</h1>
        <p className="text-sm text-muted-foreground">
          Frames and products at or below their reorder level. Tick what to order, adjust quantities, and create draft purchase orders — one per supplier.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Out of stock</p>
              <p className={`text-2xl font-bold ${counts.out ? 'text-destructive' : ''}`}>{counts.out}</p>
            </div>
            <RiAlertLine className={`h-8 w-8 ${counts.out ? 'text-destructive' : 'text-muted-foreground/40'}`} />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Running low</p>
              <p className={`text-2xl font-bold ${counts.low ? 'text-amber-600' : ''}`}>{counts.low}</p>
            </div>
            <RiTruckLine className={`h-8 w-8 ${counts.low ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Items to reorder</CardTitle>
              <CardDescription>The order quantity starts at a suggestion — change it as needed.</CardDescription>
            </div>
            <Badge variant="secondary">{items.length} items</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
              {([['all', 'All'], ['frame', 'Frames'], ['product', 'Products']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={kind === value}
                  onClick={() => { setKind(value); setSelected(new Set()) }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${kind === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={outOnly} onCheckedChange={(v) => { setOutOnly(!!v); setSelected(new Set()) }} />
              Out of stock only
            </label>
          </div>

          {chosen.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium text-primary">
                {chosen.length} item{chosen.length === 1 ? '' : 's'} · {supplierCount} supplier{supplierCount === 1 ? '' : 's'}
                {estimate > 0 && ` · est. ${formatCurrency(estimate)}`}
              </span>
              {noSupplier > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{noSupplier} without a supplier will be skipped</span>}
              <div className="flex-1" />
              <Button size="sm" className="gap-1.5" disabled={reorderMutation.isPending} onClick={() => reorderMutation.mutate()}>
                {reorderMutation.isPending ? <RiLoader4Line className="size-4 animate-spin" /> : <RiShoppingCartLine className="size-4" />}
                Create draft purchase orders
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RiLoader4Line className="size-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RiCheckDoubleLine className="mb-2 h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium">Nothing is running low</p>
              <p className="text-xs text-muted-foreground">Items appear here when they reach their reorder level.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? new Set(items.map(keyOf)) : new Set())}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="text-right">Reorder at</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-28 text-right">Order qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={keyOf(item)} className="cursor-pointer" data-state={selected.has(keyOf(item)) ? 'selected' : undefined} onClick={() => toggle(item)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(keyOf(item))} onCheckedChange={() => toggle(item)} aria-label={`Select ${item.name}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{item.kind}</Badge>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{[item.detail, item.sku].filter(Boolean).join(' · ')}</p>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${item.out_of_stock ? 'text-destructive' : 'text-amber-600'}`}>
                        {item.current_stock}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{item.reorder_level}</TableCell>
                      <TableCell className="text-sm">{item.supplier_name || <span className="text-muted-foreground italic">No supplier</span>}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20 text-right ml-auto"
                          value={qtyOf(item)}
                          onChange={(e) => setQuantities((prev) => ({ ...prev, [keyOf(item)]: Math.max(1, Number(e.target.value) || 1) }))}
                          aria-label={`Order quantity for ${item.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default LowStockReorder
