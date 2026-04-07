import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import toast from 'react-hot-toast'
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

  const approveOrder = async (order: PurchaseOrder) => {
    try {
      await suppliersApi.updatePurchaseOrderStatus(order.id, 'Approved')
      toast.success('Purchase order approved')
      refetch()
    } catch {
      toast.error('Failed to approve purchase order')
    }
  }

  const downloadPdf = async (order: PurchaseOrder) => {
    try {
      const blob = await suppliersApi.downloadPurchaseOrderPdf(order.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${order.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Purchase order PDF downloaded')
    } catch {
      toast.error('Failed to download purchase order PDF')
    }
  }

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
                    <div className="flex gap-2">
                      <CommonButton variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setIsOpen(true) }}>View</CommonButton>
                      {order.status === 'Draft' ? (
                        <CommonButton size="sm" onClick={() => approveOrder(order)}>Approve</CommonButton>
                      ) : (
                        <CommonButton size="sm" disabled>Approved</CommonButton>
                      )}
                      <CommonButton variant="secondary" size="sm" onClick={() => downloadPdf(order)}>Download PDF</CommonButton>
                    </div>
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
