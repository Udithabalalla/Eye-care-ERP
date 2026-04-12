import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import toast from 'react-hot-toast'
import { TableCard, Table, Input, BadgeWithDot } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import CreatePurchaseOrderAssistant from '@/components/purchase-orders/CreatePurchaseOrderAssistant'
import ReceiveGoodsAssistant from '@/components/purchase-orders/ReceiveGoodsAssistant'
import { formatCurrency } from '@/utils/formatters'

const PurchaseOrders = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({ queryKey: ['purchase-orders', search], queryFn: () => suppliersApi.getPurchaseOrders({ page: 1, page_size: 100 }) })

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Approved':
        return 'success'
      case 'Draft':
        return 'gray'
      case 'Ordered':
        return 'brand'
      case 'Received':
        return 'warning'
      case 'Closed':
        return 'error'
      default:
        return 'gray'
    }
  }

  const changeStatus = async (order: PurchaseOrder, status: 'Approved' | 'Ordered') => {
    try {
      await suppliersApi.updatePurchaseOrderStatus(order.id, status)
      const successMessage = status === 'Approved'
        ? 'Purchase order approved'
        : 'Purchase order marked as ordered'
      toast.success(successMessage)
      refetch()
    } catch {
      const errorMessage = status === 'Approved'
        ? 'Failed to approve purchase order'
        : 'Failed to mark purchase order as ordered'
      toast.error(errorMessage)
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
            <CommonButton onClick={() => { setSelectedOrder(null); setIsCreateOpen(true) }}><Plus className="w-4 h-4 mr-2" />Create PO</CommonButton>
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
                  <Table.Cell>{order.supplier_information?.supplier_name || order.supplier_id}</Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot size="sm" color={getStatusColor(order.status)}>
                      {order.status}
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell>{formatCurrency(order.total_amount)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      {order.status === 'Draft' ? (
                        <CommonButton size="sm" onClick={() => changeStatus(order, 'Approved')}>Approve</CommonButton>
                      ) : order.status === 'Approved' ? (
                        <CommonButton size="sm" onClick={() => changeStatus(order, 'Ordered')}>Mark Ordered</CommonButton>
                      ) : order.status === 'Ordered' ? (
                        <CommonButton size="sm" onClick={() => { setSelectedOrder(order); setIsReceiveOpen(true) }}>Receive Goods</CommonButton>
                      ) : (
                        <CommonButton size="sm" disabled>{order.status}</CommonButton>
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
      {isCreateOpen && <CreatePurchaseOrderAssistant isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => { setIsCreateOpen(false); refetch() }} />}
      {selectedOrder && isReceiveOpen && <ReceiveGoodsAssistant isOpen={isReceiveOpen} order={selectedOrder} onClose={() => setIsReceiveOpen(false)} onSuccess={() => { setIsReceiveOpen(false); setSelectedOrder(null); refetch() }} />}
    </div>
  )
}

export default PurchaseOrders
