import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
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
    queryFn: () => inventoryMovementsApi.getAll({ page: 1, page_size: 100, reference_type: referenceType || undefined }),
  })

  const rows = (data?.data || []).filter((movement) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [movement.movement_id, movement.product_id, movement.reference_id].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Inventory Movements</CardTitle>
              <Badge variant="secondary">{rows.length}</Badge>
            </div>
            <CardDescription>Every stock change is recorded here</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search movements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={referenceType || 'all'}
              onValueChange={(val) => setReferenceType(val === 'all' ? '' : val as LedgerReferenceType)}
            >
              <SelectTrigger className="w-full sm:w-48">
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
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
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
                    <TableCell>{movement.movement_type}</TableCell>
                    <TableCell>{movement.product_id}</TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                    <TableCell>{movement.reference_type} / {movement.reference_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default InventoryMovements
