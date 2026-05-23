import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiBox3Line, RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'
import { inventoryMovementsApi } from '@/api/erp.api'
import { InventoryMovement } from '@/types/erp.types'
import { format } from 'date-fns'

const MOVEMENT_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  PURCHASE_IN: 'default',
  SALE_OUT: 'secondary',
  RETURN: 'outline',
  ADJUSTMENT: 'outline',
}

export default function InventoryMovements() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [referenceType, setReferenceType] = useState('')
  const [movementType, setMovementType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', page, referenceType, movementType],
    queryFn: () =>
      inventoryMovementsApi.getAll({
        page,
        page_size: 20,
        reference_type: referenceType || undefined,
        movement_type: movementType || undefined,
      }),
  })

  const rows = (data?.data ?? []).filter((m) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [m.movement_id, m.product_id, m.variant_id, m.reference_id, m.created_by]
      .filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Movements</h1>
          <p className="text-sm text-muted-foreground">Complete audit trail of every stock change in the system.</p>
        </div>
        <Badge variant="secondary">{data?.total ?? 0} total records</Badge>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-xl">Movement Log</CardTitle>
            <CardDescription>Filter by type, reference, or search by variant SKU.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search variant, reference…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={movementType || 'all'} onValueChange={(v) => { setMovementType(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Movement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="PURCHASE_IN">Purchase In</SelectItem>
                <SelectItem value="SALE_OUT">Sale Out</SelectItem>
                <SelectItem value="RETURN">Return</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={referenceType || 'all'} onValueChange={(v) => { setReferenceType(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Reference type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All references</SelectItem>
                <SelectItem value="INVOICE">Invoice</SelectItem>
                <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem value="SALES_ORDER">Sales Order</SelectItem>
                <SelectItem value="STOCK_ADJUSTMENT">Stock Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Variant / Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m: InventoryMovement) => (
                      <TableRow key={m.movement_id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy HH:mm') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={MOVEMENT_TYPE_COLORS[m.movement_type] ?? 'outline'} className="text-xs">
                            {m.movement_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{m.variant_id || m.product_id}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold tabular-nums ${m.movement_type === 'SALE_OUT' ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                            {m.movement_type === 'SALE_OUT' ? '-' : '+'}{Math.abs(m.quantity)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{m.reference_type}</span>
                            <span className="font-mono text-xs">{m.reference_id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.created_by}</TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No movements found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {data && (
                <Pagination
                  currentPage={page}
                  totalPages={data.total_pages}
                  onPageChange={setPage}
                  pageSize={20}
                  onPageSizeChange={() => {}}
                  totalItems={data.total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
