import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiBox3Line } from '@remixicon/react'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loading from '@/components/common/Loading'
import { inventoryMovementsApi } from '@/api/erp.api'
import { InventoryMovement, LedgerReferenceType } from '@/types/erp.types'
import { formatDate } from '@/utils/formatters'

const InventoryMovements = () => {
  const [search, setSearch] = useState('')
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', referenceType],
    queryFn: () =>
      inventoryMovementsApi.getAll({
        page: 1,
        page_size: 100,
        reference_type: referenceType || undefined,
      }),
  })

  const rows = (data?.data || []).filter((movement) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [movement.movement_id, movement.product_id, movement.reference_id]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Inventory Movements
          </h1>
          <p className="text-sm text-muted-foreground">Every stock change is recorded here.</p>
        </div>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Movement Records</CardTitle>
              <CardDescription>Filter and explore all inventory movements.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {rows.length} total
            </Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <RiBox3Line className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search movements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={referenceType || 'all'}
              onValueChange={(val) =>
                setReferenceType(val === 'all' ? '' : (val as LedgerReferenceType))
              }
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter by reference type">
                <SelectValue placeholder="Reference Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                <SelectItem value="INVOICE">Invoice</SelectItem>
                <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem value="STOCK_ADJUSTMENT">Stock Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((movement: InventoryMovement) => (
                    <TableRow key={movement.movement_id}>
                      <TableCell>{formatDate(movement.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{movement.movement_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground text-sm">
                          {movement.product_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold tabular-nums ${
                            movement.quantity > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-destructive'
                          }`}
                        >
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {movement.reference_type} / {movement.reference_id}
                        </span>
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

export default InventoryMovements
