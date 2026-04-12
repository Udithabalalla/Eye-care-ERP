import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
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
        received_quantity: item.quantity,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Goods - ${order.id}`}
      size="xl"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} isLoading={receiveMutation.isPending}>Confirm Receipt</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div><span className="font-medium text-secondary">Order ID:</span> {order.id}</div>
            <div><span className="font-medium text-secondary">Supplier:</span> {order.supplier_id}</div>
            <div><span className="font-medium text-secondary">Status:</span> {order.status}</div>
          </div>
          <p className="mt-2 text-sm text-tertiary">Confirm the quantities received from the supplier before updating stock.</p>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.product_id} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-white p-4 shadow-sm md:grid-cols-12 md:items-end">
              <div className="md:col-span-5">
                <label className="mb-2 block text-sm font-medium text-secondary">Product</label>
                <Input value={item.product_name} readOnly />
                <p className="mt-1 text-xs text-tertiary">Ordered: {item.ordered_quantity}</p>
              </div>
              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-medium text-secondary">Ordered Quantity</label>
                <Input value={item.ordered_quantity} readOnly />
              </div>
              <div className="md:col-span-4">
                <label className="mb-2 block text-sm font-medium text-secondary">Received Quantity</label>
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
    </Modal>
  )
}

export default ReceiveGoodsAssistant