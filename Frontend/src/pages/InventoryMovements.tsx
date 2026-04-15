import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem } from '@/components/ui'
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
      <TableCard.Root>
        <TableCard.Header
          title="Inventory Movements"
          badge={rows.length}
          description="Every stock change is recorded here"
          contentTrailing={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search movements..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <Select selectedKey={referenceType || 'all'} onSelectionChange={(key) => setReferenceType(key === 'all' ? '' : String(key) as LedgerReferenceType)} placeholder="Reference Type">
                <SelectItem id="all">All References</SelectItem>
                <SelectItem id="INVOICE">Invoice</SelectItem>
                <SelectItem id="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem id="STOCK_ADJUSTMENT">Stock Adjustment</SelectItem>
              </Select>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Inventory movements table">
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Movement" />
              <Table.Head label="Product" />
              <Table.Head label="Quantity" />
              <Table.Head label="Reference" />
            </Table.Header>
            <Table.Body items={rows as InventoryMovement[]}>
              {(movement) => (
                <Table.Row id={movement.movement_id}>
                  <Table.Cell>{formatDate(movement.created_at)}</Table.Cell>
                  <Table.Cell>{movement.movement_type}</Table.Cell>
                  <Table.Cell>{movement.product_id}</Table.Cell>
                  <Table.Cell>{movement.quantity}</Table.Cell>
                  <Table.Cell>{movement.reference_type} / {movement.reference_id}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
    </div>
  )
}

export default InventoryMovements