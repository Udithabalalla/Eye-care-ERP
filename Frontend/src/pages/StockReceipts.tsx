import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine, RiBox3Line } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import ReceiveGoodsAssistant from '@/components/purchase-orders/ReceiveGoodsAssistant'

const StockReceipts = () => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders', 'receipts', search],
    queryFn: () => suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, status: 'Ordered' }),
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Stock Receipts</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Receive stock against purchase orders</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data || []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.supplier_information?.supplier_name || order.supplier_id}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                        <RiBox3Line className="w-4 h-4 mr-2" />
                        Receive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {selectedOrder && (
        <ReceiveGoodsAssistant
          isOpen={Boolean(selectedOrder)}
          order={selectedOrder}
          onSuccess={() => { setSelectedOrder(null); refetch() }}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

export default StockReceipts
