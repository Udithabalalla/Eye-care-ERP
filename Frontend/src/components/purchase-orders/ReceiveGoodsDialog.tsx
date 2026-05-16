import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, ReceiveGoodsLineItem } from '@/types/supplier.types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RiLoader4Line, RiTruckLine } from '@remixicon/react'

interface ReceiveGoodsDialogProps {
  isOpen: boolean
  order: PurchaseOrder | null
  onClose: () => void
  onSuccess: (updatedOrder: PurchaseOrder) => void
}

const ReceiveGoodsDialog = ({ isOpen, order, onClose, onSuccess }: ReceiveGoodsDialogProps) => {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ReceiveGoodsLineItem[]>([])

  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })

  useEffect(() => {
    if (!order) {
      setItems([])
      return
    }
    setItems(
      order.items.map((item) => {
        const product = products?.data.find((p) => p.product_id === item.product_id)
        return {
          product_id: item.product_id,
          product_name: product?.name || item.product_id,
          ordered_quantity: item.quantity,
          received_quantity: item.quantity,
        }
      }),
    )
  }, [order, products?.data, isOpen])

  const receiveMutation = useMutation({
    mutationFn: (payload: {
      items: Array<{ product_id: string; ordered_quantity: number; received_quantity: number }>
    }) => suppliersApi.receiveStock(order!.id, payload),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', order?.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Goods received successfully')
      onSuccess(updatedOrder)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to receive stock')
    },
  })

  const handleConfirm = () => {
    if (!items.length) {
      toast.error('No items to receive')
      return
    }
    receiveMutation.mutate({
      items: items.map((item) => ({
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: Number(item.received_quantity),
      })),
    })
  }

  if (!order) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiTruckLine className="size-4 text-purple-600" />
            Receive Goods — {order.id}
          </DialogTitle>
          <DialogDescription>
            Confirm quantities received from{' '}
            {order.supplier_information?.supplier_name || order.supplier_id} before updating stock.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-28 text-center">Ordered</TableHead>
                <TableHead className="w-32 text-center">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.product_id}>
                  <TableCell>
                    <p className="font-medium text-foreground text-sm">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.product_id}</p>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{item.ordered_quantity}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={item.ordered_quantity}
                      value={item.received_quantity}
                      className="h-8 text-center tabular-nums"
                      onChange={(e) => {
                        const next = [...items]
                        next[index] = {
                          ...next[index],
                          received_quantity: Number(e.target.value),
                        }
                        setItems(next)
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={receiveMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={receiveMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600 gap-2"
          >
            {receiveMutation.isPending ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiTruckLine className="size-4" />
            )}
            Confirm Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReceiveGoodsDialog
