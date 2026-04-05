import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { TableCard, Table, Input } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import PurchaseOrderForm from '@/components/suppliers/PurchaseOrderForm'

const PurchaseOrders = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({ queryKey: ['purchase-orders', search], queryFn: () => suppliersApi.getPurchaseOrders({ page: 1, page_size: 100 }) })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header title="Purchase Orders" badge={data?.total || 0} description="Create and track supplier purchase orders" contentTrailing={(
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Input placeholder="Search purchase orders..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
            <CommonButton onClick={() => { setSelectedOrder(null); setIsOpen(true) }}><Plus className="w-4 h-4 mr-2" />Create PO</CommonButton>
          </div>
        )} />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Order ID" isRowHeader />
              <Table.Head label="Supplier" />
              <Table.Head label="Status" />
              <Table.Head label="Total" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((order) => (
                <Table.Row key={order.id}>
                  <Table.Cell>{order.id}</Table.Cell>
                  <Table.Cell>{order.supplier_id}</Table.Cell>
                  <Table.Cell>{order.status}</Table.Cell>
                  <Table.Cell>{order.total_amount.toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <CommonButton variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setIsOpen(true) }}>Edit</CommonButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
      {isOpen && <PurchaseOrderForm order={selectedOrder} onSuccess={() => { setIsOpen(false); refetch() }} onCancel={() => setIsOpen(false)} />}
    </div>
  )
}

export default PurchaseOrders
