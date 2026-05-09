import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiTruckLine } from '@remixicon/react'
import toast from 'react-hot-toast'
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

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Approved: 'default',
  Draft: 'outline',
  Ordered: 'secondary',
  Received: 'secondary',
  Closed: 'destructive',
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
      toast.success(
        status === 'Approved' ? 'Purchase order approved' : 'Purchase order marked as ordered',
      )
      refetch()
    } catch {
      toast.error(
        status === 'Approved'
          ? 'Failed to approve purchase order'
          : 'Failed to mark purchase order as ordered',
      )
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

  const rows = (data?.data || []).filter((order) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [order.id, order.supplier_id, order.status].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Create and track supplier purchase orders.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedOrder(null); setIsCreateOpen(true) }}
        >
          <RiAddLine className="size-4" />
          Create PO
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Order Records</CardTitle>
              <CardDescription>Manage and track all purchase orders.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="relative w-full sm:w-72">
            <RiTruckLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search purchase orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
                    <TableHead>Order ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{order.id}</span>
                      </TableCell>
                      <TableCell>
                        {order.supplier_information?.supplier_name || order.supplier_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status] ?? 'outline'}>
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
                          <DropdownMenuContent align="end" className="w-52">
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
                              <DropdownMenuItem
                                onClick={() => { setSelectedOrder(order); setIsReceiveOpen(true) }}
                              >
                                Receive Goods
                              </DropdownMenuItem>
                            )}
                            {order.status === 'Received' && (
                              <DropdownMenuItem
                                onClick={() => { setSelectedOrder(order); setIsInvoiceOpen(true) }}
                              >
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
            </div>
          )}
        </CardContent>
      </Card>

      {isCreateOpen && (
        <CreatePurchaseOrderAssistant
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => { setIsCreateOpen(false); refetch() }}
        />
      )}
      {selectedOrder && isReceiveOpen && (
        <ReceiveGoodsDialog
          isOpen={isReceiveOpen}
          order={selectedOrder}
          onClose={() => setIsReceiveOpen(false)}
          onSuccess={(updatedOrder) => {
            setSelectedOrder(updatedOrder)
            setIsReceiveOpen(false)
            setIsInvoiceOpen(true)
            refetch()
          }}
        />
      )}
      {selectedOrder && isInvoiceOpen && (
        <CreateSupplierInvoiceDialog
          isOpen={isInvoiceOpen}
          order={selectedOrder}
          onClose={() => setIsInvoiceOpen(false)}
          onSuccess={() => { setIsInvoiceOpen(false); setSelectedOrder(null); refetch() }}
        />
      )}
    </div>
  )
}

export default PurchaseOrders
