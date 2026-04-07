import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import toast from 'react-hot-toast'
import { TableCard, Table, Input, BadgeWithDot, Tooltip, TooltipTrigger } from '@/components/ui'
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

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Approved':
        return 'success'
      case 'Draft':
        return 'gray'
      case 'Sent':
        return 'brand'
      case 'Received':
        return 'warning'
      case 'Closed':
        return 'error'
      default:
        return 'gray'
    }
  }

  const getPresenceColor = (present: boolean) => (present ? 'success' : 'gray')

  const getCompletion = (order: PurchaseOrder) => {
    const sections = [
      Boolean(order.buyer_information?.company_name),
      Boolean(order.supplier_information?.supplier_name || order.supplier_information?.company_name),
      Boolean(order.shipping_information?.delivery_address || order.shipping_information?.ship_to_location),
      order.items.length > 0,
      Boolean(order.order_summary?.total_amount || order.total_amount),
      Boolean(order.payment_terms?.payment_terms || order.payment_terms?.payment_method || order.payment_terms?.currency),
      Boolean(order.notes?.supplier_notes || order.notes?.internal_notes),
      Boolean(order.authorization?.approved_by),
      Boolean(order.footer?.company_policy_note || order.footer?.contact_information),
    ]

    const completed = sections.filter(Boolean).length
    const total = sections.length
    const percentage = Math.round((completed / total) * 100)
    return { completed, total, percentage }
  }

  const changeStatus = async (order: PurchaseOrder, status: 'Approved' | 'Sent' | 'Closed') => {
    try {
      await suppliersApi.updatePurchaseOrderStatus(order.id, status)
      const successMessage = status === 'Approved'
        ? 'Purchase order approved'
        : status === 'Sent'
          ? 'Purchase order sent'
          : 'Purchase order closed'
      toast.success(successMessage)
      refetch()
    } catch {
      const errorMessage = status === 'Approved'
        ? 'Failed to approve purchase order'
        : status === 'Sent'
          ? 'Failed to send purchase order'
          : 'Failed to close purchase order'
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
            <CommonButton onClick={() => { setSelectedOrder(null); setIsOpen(true) }}><Plus className="w-4 h-4 mr-2" />Create PO</CommonButton>
          </div>
        )} />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Order ID" isRowHeader />
              <Table.Head label="Supplier" />
              <Table.Head label="Status" />
              <Table.Head label="Summary" />
              <Table.Head label="Total" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((order) => (
                <Table.Row key={order.id}>
                  <Table.Cell>{order.id}</Table.Cell>
                  <Table.Cell>{order.supplier_id}</Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot size="sm" color={getStatusColor(order.status)}>
                      {order.status}
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell>
                    {(() => {
                      const completion = getCompletion(order)
                      return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            <BadgeWithDot size="sm" color={getPresenceColor(Boolean(order.is_locked))}>
                              {order.is_locked ? 'Locked' : 'Open'}
                            </BadgeWithDot>
                            <BadgeWithDot size="sm" color={getPresenceColor(Boolean(order.buyer_information?.company_name))}>
                              Buyer
                            </BadgeWithDot>
                            <BadgeWithDot size="sm" color={getPresenceColor(Boolean(order.shipping_information?.delivery_address || order.shipping_information?.ship_to_location))}>
                              Ship
                            </BadgeWithDot>
                            <BadgeWithDot size="sm" color={getPresenceColor(Boolean(order.authorization?.approved_by))}>
                              Auth
                            </BadgeWithDot>
                          </div>

                          <Tooltip
                            title={`${completion.percentage}% complete`}
                            description={`${completion.completed}/${completion.total} sections filled`}
                            placement="top"
                          >
                            <TooltipTrigger className="group block w-full min-w-40">
                              <div className="rounded-full bg-surface-2 p-1 ring-1 ring-border transition-colors group-hover:ring-brand-200">
                                <div className="relative h-2 overflow-hidden rounded-full bg-border">
                                  <div
                                    className="h-full rounded-full bg-brand-600 transition-all duration-300"
                                    style={{ width: `${completion.percentage}%` }}
                                  />
                                </div>
                              </div>
                            </TooltipTrigger>
                          </Tooltip>
                        </div>
                      )
                    })()}
                  </Table.Cell>
                  <Table.Cell>{order.total_amount.toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <CommonButton variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setIsOpen(true) }}>View</CommonButton>
                      {order.status === 'Draft' ? (
                        <CommonButton size="sm" onClick={() => changeStatus(order, 'Approved')}>Approve</CommonButton>
                      ) : order.status === 'Approved' ? (
                        <CommonButton size="sm" onClick={() => changeStatus(order, 'Sent')}>Send</CommonButton>
                      ) : order.status === 'Received' ? (
                        <CommonButton size="sm" onClick={() => changeStatus(order, 'Closed')}>Close</CommonButton>
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
      {isOpen && <PurchaseOrderForm order={selectedOrder} onSuccess={() => { setIsOpen(false); refetch() }} onCancel={() => setIsOpen(false)} />}
    </div>
  )
}

export default PurchaseOrders
