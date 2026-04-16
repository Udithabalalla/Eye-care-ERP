import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import { Table, Badge } from '@/components/ui'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, ReceiveGoodsLineItem } from '@/types/supplier.types'

interface ReceiveGoodsDialogProps {
  isOpen: boolean
  order: PurchaseOrder | null
  onClose: () => void
  onSuccess: (updatedOrder: PurchaseOrder) => void
}

const ReceiveGoodsDialog = ({ isOpen, order, onClose, onSuccess }: ReceiveGoodsDialogProps) => {
  const queryClient = useQueryClient()
  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })
  const [items, setItems] = useState<ReceiveGoodsLineItem[]>([])

  useEffect(() => {
    if (!order) {
      setItems([])
      return
    }

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
    mutationFn: (payload: { items: Array<{ product_id: string; ordered_quantity: number; received_quantity: number }> }) => suppliersApi.receiveStock(order!.id, payload),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Goods Received Successfully')
      onSuccess(updatedOrder)
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to receive stock'
      toast.error(message)
    },
  })

  const save = () => {
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
        <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div><span className="font-medium text-secondary">Order ID:</span> {order.id}</div>
            <div><span className="font-medium text-secondary">Supplier:</span> {order.supplier_information?.supplier_name || order.supplier_id}</div>
            <div><span className="font-medium text-secondary">Status:</span> <Badge color="warning" size="sm">{order.status}</Badge></div>
          </div>
          <p className="mt-2 text-sm text-tertiary">Confirm the quantities received from the supplier before updating stock.</p>
        </div>

        <div className="overflow-hidden rounded-apple-lg border border-border bg-bg-primary shadow-xs">
          <Table size="sm">
            <Table.Header bordered>
              <Table.Head label="Product" isRowHeader />
              <Table.Head label="Ordered" />
              <Table.Head label="Received" />
            </Table.Header>
            <Table.Body>
              {items.map((item, index) => (
                <Table.Row key={item.product_id}>
                  <Table.Cell>
                    <div className="space-y-1">
                      <div className="font-medium text-primary">{item.product_name}</div>
                      <div className="text-xs text-tertiary">{item.product_id}</div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{item.ordered_quantity}</Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      min={0}
                      max={item.ordered_quantity}
                      value={item.received_quantity}
                      onChange={(value) => {
                        const next = [...items]
                        next[index] = { ...next[index], received_quantity: Number(value.target.value) }
                        setItems(next)
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>
    </Modal>
  )
}

export default ReceiveGoodsDialog