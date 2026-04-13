import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus } from '@untitledui/icons'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import AddProductAssistant from '@/components/products/AddProductAssistant'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import { PurchaseOrder, PurchaseOrderAssistantItem, PurchaseOrderFormData } from '@/types/supplier.types'

interface CreatePurchaseOrderAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order?: PurchaseOrder | null
}

type PurchaseOrderDraft = {
  supplier_id: string
  order_date: string
  expected_delivery_date: string
  shipping_address: string
  ship_to_location: string
  receiving_department: string
  delivery_instructions: string
  shipping_cost: number
  discount: number
  supplier_notes: string
  internal_notes: string
  items: PurchaseOrderAssistantItem[]
}

const createDraft = (): PurchaseOrderDraft => ({
  supplier_id: '',
  order_date: new Date().toISOString().slice(0, 16),
  expected_delivery_date: '',
  shipping_address: '',
  ship_to_location: '',
  receiving_department: '',
  delivery_instructions: '',
  shipping_cost: 0,
  discount: 0,
  supplier_notes: '',
  internal_notes: '',
  items: [{ product_id: '', description: '', quantity: 1, unit_cost: 0 }],
})

const CreatePurchaseOrderAssistant = ({ isOpen, onClose, onSuccess, order }: CreatePurchaseOrderAssistantProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }) })
  const [draft, setDraft] = useState<PurchaseOrderDraft>(createDraft())
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen && !order) {
      setDraft(createDraft())
    }
  }, [isOpen, order])

  const selectedSupplier = useMemo(
    () => suppliers?.data.find((supplier) => supplier.id === draft.supplier_id),
    [draft.supplier_id, suppliers?.data],
  )

  useEffect(() => {
    if (!selectedSupplier) return
    setDraft((current) => ({
      ...current,
      shipping_address: selectedSupplier.address || current.shipping_address,
    }))
  }, [selectedSupplier])

  const subtotal = draft.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0)
  const gross = Math.max(0, subtotal + Number(draft.shipping_cost || 0) - Number(draft.discount || 0))

  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => suppliersApi.createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created successfully')
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create purchase order'
      toast.error(message)
    },
  })

  const handleProductCreated = (product?: Product) => {
    if (!product) return

    setDraft((current) => {
      const nextItems = [...current.items]
      const itemIndex = targetItemIndex ?? nextItems.findIndex((item) => !item.product_id)
      const updateIndex = itemIndex >= 0 ? itemIndex : nextItems.length - 1

      if (!nextItems[updateIndex]) {
        nextItems.push({ product_id: '', description: '', quantity: 1, unit_cost: 0 })
      }

      nextItems[updateIndex] = {
        ...nextItems[updateIndex],
        product_id: product.product_id,
        description: product.description || product.name,
        unit_cost: product.cost_price,
      }

      return { ...current, items: nextItems }
    })

    setTargetItemIndex(null)
    setProductPickerOpen(false)
  }

  const updateItem = (index: number, updater: Partial<PurchaseOrderAssistantItem>) => {
    setDraft((current) => {
      const nextItems = [...current.items]
      nextItems[index] = { ...nextItems[index], ...updater }
      return { ...current, items: nextItems }
    })
  }

  const addItem = () => {
    setDraft((current) => ({ ...current, items: [...current.items, { product_id: '', description: '', quantity: 1, unit_cost: 0 }] }))
  }

  const openAddNewProduct = (itemIndex: number) => {
    if (!draft.supplier_id) {
      toast.error('Please select a supplier before adding a new product')
      return
    }

    setTargetItemIndex(itemIndex)
    setProductPickerOpen(true)
  }

  const removeItem = (index: number) => {
    setDraft((current) => {
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index)
      return { ...current, items: nextItems.length > 0 ? nextItems : [{ product_id: '', description: '', quantity: 1, unit_cost: 0 }] }
    })
  }

  const save = () => {
    if (!draft.supplier_id) return toast.error('Please select a supplier')
    if (!draft.shipping_address.trim()) return toast.error('Please fill delivery address')
    if (!draft.ship_to_location.trim()) return toast.error('Please fill ship to location')
    if (!draft.receiving_department.trim()) return toast.error('Please fill receiving department')
    if (draft.items.some((item) => !item.product_id || item.quantity <= 0 || item.unit_cost < 0)) {
      return toast.error('Please fill all item fields properly')
    }

    const payload: PurchaseOrderFormData = {
      supplier_id: draft.supplier_id,
      order_date: new Date(draft.order_date).toISOString(),
      expected_delivery_date: draft.expected_delivery_date ? new Date(draft.expected_delivery_date).toISOString() : undefined,
      items: draft.items.map((item) => ({
        product_id: item.product_id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
      })),
      shipping_information: {
        delivery_address: draft.shipping_address || undefined,
        ship_to_location: draft.ship_to_location || undefined,
        receiving_department: draft.receiving_department || undefined,
        delivery_instructions: draft.delivery_instructions || undefined,
      },
      summary: {
        tax_rate: 0,
        shipping_cost: Number(draft.shipping_cost),
        discount: Number(draft.discount),
      },
      notes: {
        supplier_notes: draft.supplier_notes || undefined,
        internal_notes: draft.internal_notes || undefined,
      },
    }

    createMutation.mutate(payload)
  }

  const orderStatus = order?.status

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Create Purchase Order"
        size="xl"
        footer={(
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} isLoading={createMutation.isPending}>Create PO</Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">General Information</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Supplier</label>
                <select className="input" value={draft.supplier_id} onChange={(event) => setDraft({ ...draft, supplier_id: event.target.value })}>
                  <option value="">Select an option</option>
                  {suppliers?.data.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Order Date</label>
                <Input type="datetime-local" value={draft.order_date} onChange={(event) => setDraft({ ...draft, order_date: event.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-secondary">Expected Delivery Date (optional)</label>
                <Input type="datetime-local" value={draft.expected_delivery_date} onChange={(event) => setDraft({ ...draft, expected_delivery_date: event.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-secondary">Supplier Contact</label>
                <Input value={selectedSupplier?.phone || selectedSupplier?.email || ''} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-secondary">Supplier Person</label>
                <Input value={selectedSupplier?.contact_person || ''} readOnly />
              </div>
              <div className="md:col-span-4">
                <label className="mb-2 block text-sm font-medium text-secondary">Supplier Address</label>
                <Input value={selectedSupplier?.address || ''} readOnly />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">Amounts</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Input label="Total Net Amount" value={formatCurrency(subtotal)} readOnly />
              <Input label="Total Shipping Cost" type="number" value={draft.shipping_cost} onChange={(event) => setDraft({ ...draft, shipping_cost: Number(event.target.value) })} />
              <Input label="Total Discount" type="number" value={draft.discount} onChange={(event) => setDraft({ ...draft, discount: Number(event.target.value) })} />
              <Input label="Total Gross Amount" value={formatCurrency(gross)} readOnly />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">Item Information</h4>
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4" />Add Item</Button>
            </div>
            <div className="space-y-4">
              {draft.items.map((item, index) => {
                const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)

                return (
                  <div key={`${item.product_id || 'item'}-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                    <div className="md:col-span-3">
                      <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Product</label>
                      <div className="flex gap-2">
                        <select
                          className="input"
                          value={item.product_id}
                          onChange={(event) => {
                            const product = products?.data.find((entry) => entry.product_id === event.target.value)
                            updateItem(index, {
                              product_id: event.target.value,
                              description: product?.description || product?.name || '',
                              unit_cost: product?.cost_price || 0,
                            })
                          }}
                        >
                          <option value="">Select an option</option>
                          {products?.data.map((product) => (
                            <option key={product.product_id} value={product.product_id}>{product.name}</option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openAddNewProduct(index)}
                          className="min-w-fit shrink-0 gap-1 whitespace-nowrap border-brand-200 px-3 text-brand-600 hover:bg-brand-50"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="leading-none">Add New Item</span>
                        </Button>
                      </div>
                    </div>
                    <div className="md:col-span-4">
                      <label className="mb-2 block text-sm font-medium text-secondary">Description</label>
                      <Input value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Description" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Qty Ordered</label>
                      <Input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Unit Cost</label>
                      <Input type="number" step="0.01" value={item.unit_cost} onChange={(event) => updateItem(index, { unit_cost: Number(event.target.value) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-secondary">Subtotal</label>
                      <Input value={formatCurrency(itemSubtotal)} readOnly />
                    </div>
                    <div className="md:col-span-12 flex justify-end">
                      <Button type="button" variant="ghost" onClick={() => removeItem(index)}>Remove</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">Shipping Information</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Delivery Address</label>
                <Input value={draft.shipping_address} onChange={(event) => setDraft({ ...draft, shipping_address: event.target.value })} placeholder="Delivery Address" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Ship To Location</label>
                <Input value={draft.ship_to_location} onChange={(event) => setDraft({ ...draft, ship_to_location: event.target.value })} placeholder="Ship To Location" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Receiving Department</label>
                <Input value={draft.receiving_department} onChange={(event) => setDraft({ ...draft, receiving_department: event.target.value })} placeholder="Receiving Department" />
              </div>
              <Input label="Delivery Instructions (optional)" value={draft.delivery_instructions} onChange={(event) => setDraft({ ...draft, delivery_instructions: event.target.value })} placeholder="Delivery Instructions note" />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">Notes</h4>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input label="Supplier Notes" value={draft.supplier_notes} onChange={(event) => setDraft({ ...draft, supplier_notes: event.target.value })} placeholder="Notes" />
              <Input label="Internal Notes" value={draft.internal_notes} onChange={(event) => setDraft({ ...draft, internal_notes: event.target.value })} placeholder="Notes" />
            </div>
          </section>

          {order && (
            <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-semibold text-primary">Current Purchase Order</h4>
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div><span className="font-medium text-secondary">Order ID:</span> {order.id}</div>
                <div><span className="font-medium text-secondary">Status:</span> {orderStatus}</div>
                <div><span className="font-medium text-secondary">Total:</span> {formatCurrency(order.total_amount)}</div>
              </div>
            </section>
          )}
        </div>
      </Modal>

      {productPickerOpen && (
        <Modal
          isOpen={productPickerOpen}
          onClose={() => { setProductPickerOpen(false); setTargetItemIndex(null) }}
          title="Add New Product"
          size="xl"
          className="z-[60]"
        >
          <AddProductAssistant
            isOpen={productPickerOpen}
            onClose={() => { setProductPickerOpen(false); setTargetItemIndex(null) }}
            onSuccess={handleProductCreated}
            lockedSupplierId={draft.supplier_id || undefined}
          />
        </Modal>
      )}
    </>
  )
}

export default CreatePurchaseOrderAssistant