import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg, Package } from '@untitledui/icons'
import { TableCard, Table, Input } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import ReceiveStockForm from '@/components/suppliers/ReceiveStockForm'

const StockReceipts = () => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({ queryKey: ['purchase-orders', 'receipts', search], queryFn: () => suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, status: 'Sent' }) })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header title="Stock Receipts" badge={data?.total || 0} description="Receive stock against purchase orders" contentTrailing={(
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Input placeholder="Search orders..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
          </div>
        )} />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Order ID" isRowHeader />
              <Table.Head label="Supplier" />
              <Table.Head label="Status" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((order) => (
                <Table.Row key={order.id}>
                  <Table.Cell>{order.id}</Table.Cell>
                  <Table.Cell>{order.supplier_id}</Table.Cell>
                  <Table.Cell>{order.status}</Table.Cell>
                  <Table.Cell>
                    <CommonButton variant="outline" size="sm" onClick={() => setSelectedOrder(order)}><Package className="w-4 h-4 mr-2" />Receive</CommonButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
      {selectedOrder && <ReceiveStockForm order={selectedOrder} onSuccess={() => { setSelectedOrder(null); refetch() }} onCancel={() => setSelectedOrder(null)} />}
    </div>
  )
}

export default StockReceipts
