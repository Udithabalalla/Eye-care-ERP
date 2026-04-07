import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { productsApi } from '@/api/products.api'
import { PurchaseOrder, PurchaseOrderFormData } from '@/types/supplier.types'

interface PurchaseOrderFormProps {
  order?: PurchaseOrder | null
  onSuccess: () => void
  onCancel: () => void
}

const PurchaseOrderForm = ({ order, onSuccess, onCancel }: PurchaseOrderFormProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }) })
  const [form, setForm] = useState<PurchaseOrderFormData>({ supplier_id: '', order_date: new Date().toISOString(), items: [{ product_id: '', quantity: 1, unit_cost: 0 }] })

  useEffect(() => {
    if (order) {
      setForm({
        supplier_id: order.supplier_id,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date,
        items: order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, unit_cost: item.unit_cost })),
      })
    }
  }, [order])

  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => suppliersApi.createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created successfully')
      onSuccess()
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || 'Failed to create purchase order'
      toast.error(msg)
    },
  })

  const updateStatus = useMutation({
    mutationFn: (status: string) => suppliersApi.updatePurchaseOrderStatus(order!.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order updated successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to update purchase order'),
  })

  const totalAmount = form.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)

  const save = () => {
    if (!form.supplier_id) { toast.error('Please select a supplier'); return }
    const hasInvalidItem = form.items.some(i => !i.product_id || i.quantity <= 0 || i.unit_cost < 0)
    if (hasInvalidItem) { toast.error('Please fill all item fields properly'); return }
    // Send null for empty delivery date (not empty string which causes 422)
    const payload: PurchaseOrderFormData = {
      ...form,
      expected_delivery_date: form.expected_delivery_date || undefined,
    }
    if (order) updateStatus.mutate('Sent')
    else createMutation.mutate(payload)
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={order ? 'Update Purchase Order' : 'Create Purchase Order'}
      size="xl"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} isLoading={createMutation.isPending || updateStatus.isPending}>Save</Button>
        </div>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Supplier</label>
          <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Select supplier</option>
            {suppliers?.data.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
            ))}
          </select>
        </div>
        <Input label="Order Date" type="datetime-local" value={form.order_date.slice(0, 16)} onChange={(e) => setForm({ ...form, order_date: new Date(e.target.value).toISOString() })} />
        <Input label="Expected Delivery Date" type="date" value={form.expected_delivery_date || ''} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} />
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Items</h4>
        {form.items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-secondary mb-2">Product</label>
              <select className="input" value={item.product_id} onChange={(e) => {
                const next = [...form.items]
                next[index].product_id = e.target.value
                setForm({ ...form, items: next })
              }}>
                <option value="">Select product</option>
                {products?.data.map((product) => (
                  <option key={product.product_id} value={product.product_id}>{product.name}</option>
                ))}
              </select>
            </div>
            <Input label="Quantity" type="number" value={item.quantity} onChange={(e) => {
              const next = [...form.items]
              next[index].quantity = Number(e.target.value)
              setForm({ ...form, items: next })
            }} />
            <Input label="Unit Cost" type="number" step="0.01" value={item.unit_cost} onChange={(e) => {
              const next = [...form.items]
              next[index].unit_cost = Number(e.target.value)
              setForm({ ...form, items: next })
            }} />
          </div>
        ))}
        <Button variant="outline" onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_cost: 0 }] })}>Add Item</Button>
        <p className="text-sm text-secondary">Total: {totalAmount.toFixed(2)}</p>
      </div>
    </Modal>
  )
}

export default PurchaseOrderForm
