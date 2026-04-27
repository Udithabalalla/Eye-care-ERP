import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiAddLine, RiSearchLine, RiMore2Line } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import CreatePurchaseOrderAssistant from '@/components/purchase-orders/CreatePurchaseOrderAssistant'
import ReceiveGoodsDialog from '@/components/purchase-orders/ReceiveGoodsDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'
import { formatCurrency } from '@/utils/formatters'

const statusBadgeClass = (status: PurchaseOrder['status']) => {
  switch (status) {
    case 'Approved': return 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
    case 'Draft': return 'border-border bg-secondary text-muted-foreground'
    case 'Ordered': return 'border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
    case 'Received': return 'border-warning-200 bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400'
    case 'Closed': return 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'
    default: return 'border-border bg-secondary text-muted-foreground'
  }
}

const PurchaseOrders = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders', search],
    queryFn: () => suppliersApi.getPurchaseOrders({ page: 1, page_size: 100 }),
  })

  const changeStatus = async (order: PurchaseOrder, status: 'Approved' | 'Ordered') => {
    try {
      await suppliersApi.updatePurchaseOrderStatus(order.id, status)
      toast.success(status === 'Approved' ? 'Purchase order approved' : 'Purchase order marked as ordered')
      refetch()
    } catch {
      toast.error(status === 'Approved' ? 'Failed to approve purchase order' : 'Failed to mark purchase order as ordered')
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
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Purchase Orders</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Create and track supplier purchase orders</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search purchase orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => { setSelectedOrder(null); setIsCreateOpen(true) }}>
              <RiAddLine className="size-4 mr-1" />
              Create PO
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data || []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.supplier_information?.supplier_name || order.supplier_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[state=open]:bg-muted"
                            aria-label="Open purchase order actions"
                          >
                            <RiMore2Line className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {order.status === 'Draft' && (
                            <DropdownMenuItem onClick={() => changeStatus(order, 'Approved')}>
                              Approve Order
                            </DropdownMenuItem>
                          )}
                          {order.status === 'Approved' && (
                            <DropdownMenuItem onClick={() => changeStatus(order, 'Ordered')}>
                              Mark as Ordered
                            </DropdownMenuItem>
                          )}
                          {order.status === 'Ordered' && (
                            <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsReceiveOpen(true) }}>
                              Receive Goods
                            </DropdownMenuItem>
                          )}
                          {order.status === 'Received' && (
                            <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsInvoiceOpen(true) }}>
                              Create Supplier Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => downloadPdf(order)}>
                            Download PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {isCreateOpen && <CreatePurchaseOrderAssistant isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => { setIsCreateOpen(false); refetch() }} />}
      {selectedOrder && isReceiveOpen && <ReceiveGoodsDialog isOpen={isReceiveOpen} order={selectedOrder} onClose={() => setIsReceiveOpen(false)} onSuccess={(updatedOrder) => { setSelectedOrder(updatedOrder); setIsReceiveOpen(false); setIsInvoiceOpen(true); refetch() }} />}
      {selectedOrder && isInvoiceOpen && <CreateSupplierInvoiceDialog isOpen={isInvoiceOpen} order={selectedOrder} onClose={() => setIsInvoiceOpen(false)} onSuccess={() => { setIsInvoiceOpen(false); setSelectedOrder(null); refetch() }} />}
    </div>
  )
}

export default PurchaseOrders
