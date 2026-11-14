import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, ReceiveGoodsLineItem } from '@/types/supplier.types'

interface ReceiveGoodsAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order: PurchaseOrder
}

const ReceiveGoodsAssistant = ({ isOpen, onClose, onSuccess, order }: ReceiveGoodsAssistantProps) => {
  const queryClient = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }) })
  const [items, setItems] = useState<ReceiveGoodsLineItem[]>([])

  useEffect(() => {
    if (!order) return

    setItems(order.items.map((item) => {
      const product = products?.data.find((entry) => entry.product_id === item.product_id)
      return {
        product_id: item.product_id,
        product_name: product?.name || item.product_id,
        ordered_quantity: item.quantity,
        // Start at what's still outstanding — earlier deliveries already counted
        received_quantity: Math.max(item.quantity - (item.received_quantity ?? 0), 0),
      }
    }))
  }, [order, products?.data, isOpen])

  const receiveMutation = useMutation({
    mutationFn: (payload: { items: Array<{ product_id: string; ordered_quantity: number; received_quantity: number }> }) => suppliersApi.receiveStock(order.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock received successfully')
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to receive stock'
      toast.error(message)
    },
  })

  const save = () => {
    if (items.length === 0) return toast.error('No items to receive')

    receiveMutation.mutate({
      items: items.map((item) => ({
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: Number(item.received_quantity),
      })),
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">{`Receive Goods - ${order.id}`}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div><span className="font-medium text-muted-foreground">Order ID:</span> {order.id}</div>
                <div><span className="font-medium text-muted-foreground">Supplier:</span> {order.supplier_id}</div>
                <div><span className="font-medium text-muted-foreground">Status:</span> {order.status}</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Confirm the quantities received from the supplier before updating stock.</p>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.product_id} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm md:grid-cols-12 md:items-end">
                  <div className="md:col-span-5">
                    <Label className="mb-2 text-muted-foreground">Product</Label>
                    <Input value={item.product_name} readOnly />
                    <p className="mt-1 text-xs text-muted-foreground">Ordered: {item.ordered_quantity}</p>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="mb-2 text-muted-foreground">Ordered Quantity</Label>
                    <Input value={item.ordered_quantity} readOnly />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="mb-2 text-muted-foreground">Received Quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      max={item.ordered_quantity}
                      value={item.received_quantity}
                      onChange={(event) => {
                        const next = [...items]
                        next[index] = { ...next[index], received_quantity: Number(event.target.value) }
                        setItems(next)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={receiveMutation.isPending}>
              {receiveMutation.isPending && <Spinner />}
              Confirm Receipt
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReceiveGoodsAssistant
