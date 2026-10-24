import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine, RiBox3Line, RiInboxLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder } from '@/types/supplier.types'
import ReceiveGoodsAssistant from '@/components/purchase-orders/ReceiveGoodsAssistant'
import { formatDate } from '@/utils/formatters'

/**
 * Purchase orders waiting for (the rest of) their delivery, with the receive
 * assistant. Receiving here updates stock, the movement log and the PO itself.
 */
const PurchaseOrderReceiving = () => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders', 'awaiting-delivery'],
    queryFn: async () => {
      const [ordered, partial] = await Promise.all([
        suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, status: 'Ordered' }),
        suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, status: 'Partially Received' }),
      ])
      return [...(partial.data || []), ...(ordered.data || [])]
    },
  })

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data ?? []
    return (data ?? []).filter((order) =>
      [order.order_number, order.id, order.supplier_information?.supplier_name, order.supplier_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [data, search])

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle>Awaiting delivery</CardTitle>
                <Badge variant="secondary">{orders.length}</Badge>
              </div>
              <CardDescription>Ordered purchase orders. Receive what arrived — short deliveries stay open as partially received.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search PO number or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RiInboxLine className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nothing waiting to be received</p>
              <p className="text-xs text-muted-foreground">Purchase orders show up here once they're marked as ordered.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-medium">{order.order_number || order.id}</TableCell>
                    <TableCell>{order.supplier_information?.supplier_name || order.supplier_id}</TableCell>
                    <TableCell className="text-muted-foreground">{order.order_date ? formatDate(order.order_date) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.items?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'Partially Received' ? 'secondary' : 'outline'}>{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order) }}>
                        <RiBox3Line className="mr-2 h-4 w-4" />
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
    </>
  )
}

export default PurchaseOrderReceiving
