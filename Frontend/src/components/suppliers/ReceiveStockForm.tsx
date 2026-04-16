import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, ReceiveStockFormData } from '@/types/supplier.types'

interface ReceiveStockFormProps {
  order?: PurchaseOrder | null
  onSuccess: () => void
  onCancel: () => void
}

const ReceiveStockForm = ({ order, onSuccess, onCancel }: ReceiveStockFormProps) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ReceiveStockFormData>({ items: [] })

  useEffect(() => {
    if (order) {
      setForm({ items: order.items.map((item) => ({ product_id: item.product_id, ordered_quantity: item.quantity, received_quantity: item.quantity })) })
    }
  }, [order])

  const mutation = useMutation({
    mutationFn: (data: ReceiveStockFormData) => suppliersApi.receiveStock(order!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock received successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to receive stock'),
  })

  if (!order) return null

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={`Receive Stock - ${order.id}`}
      size="xl"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)}>Confirm Receipt</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {form.items.map((item, index) => (
          <div key={item.product_id} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border/70 bg-surface/60 p-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-primary">Product: {item.product_id}</p>
              <p className="text-xs text-tertiary">Ordered: {item.ordered_quantity}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Received Quantity</label>
              <input
                type="number"
                className="input"
                value={item.received_quantity}
                min={0}
                max={item.ordered_quantity}
                onChange={(e) => {
                  const next = [...form.items]
                  next[index].received_quantity = Number(e.target.value)
                  setForm({ items: next })
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default ReceiveStockForm
