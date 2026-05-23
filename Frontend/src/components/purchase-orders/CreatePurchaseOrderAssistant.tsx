import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiAddLine, RiDeleteBinLine } from '@remixicon/react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import AddProductAssistant from '@/components/products/AddProductAssistant'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { companyProfileApi } from '@/api/company-profile.api'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import { FrameVariant } from '@/types/frames.types'
import { PurchaseOrder, PurchaseOrderAssistantItem, PurchaseOrderFormData } from '@/types/supplier.types'

interface CreatePurchaseOrderAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order?: PurchaseOrder | null
}

type DraftItem = PurchaseOrderAssistantItem & {
  _key: string
  variantObj?: FrameVariant
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
  items: DraftItem[]
}

const blankItem = (): DraftItem => ({
  _key: crypto.randomUUID(),
  item_type: 'frame_variant',
  product_id: undefined,
  frame_variant_id: undefined,
  description: '',
  quantity: 1,
  unit_cost: 0,
})

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
  items: [blankItem()],
})

const CreatePurchaseOrderAssistant = ({ isOpen, onClose, onSuccess, order }: CreatePurchaseOrderAssistantProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }) })
  const { data: companyProfile } = useQuery({ queryKey: ['company-profile'], queryFn: () => companyProfileApi.get() })
  const [draft, setDraft] = useState<PurchaseOrderDraft>(createDraft())
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [targetItemKey, setTargetItemKey] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && !order) setDraft(createDraft())
  }, [isOpen, order])

  const selectedSupplier = useMemo(
    () => suppliers?.data.find((s) => s.id === draft.supplier_id),
    [draft.supplier_id, suppliers?.data],
  )

  useEffect(() => {
    if (!isOpen || order || !companyProfile) return
    setDraft((cur) => ({
      ...cur,
      shipping_address: cur.shipping_address || companyProfile.default_delivery_address || companyProfile.address || '',
      ship_to_location: cur.ship_to_location || companyProfile.default_ship_to_location || '',
      receiving_department: cur.receiving_department || companyProfile.default_receiving_department || '',
      delivery_instructions: cur.delivery_instructions || companyProfile.default_delivery_instructions || '',
    }))
  }, [companyProfile, isOpen, order])

  const subtotal = draft.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0)
  const gross = Math.max(0, subtotal + Number(draft.shipping_cost || 0) - Number(draft.discount || 0))

  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft((cur) => ({ ...cur, items: cur.items.map((i) => i._key === key ? { ...i, ...patch } : i) }))

  const setItemType = (key: string, type: 'product' | 'frame_variant') =>
    patchItem(key, { item_type: type, product_id: undefined, frame_variant_id: undefined, variantObj: undefined, description: '', unit_cost: 0 })

  const setVariant = (key: string, v: FrameVariant | null) => {
    if (!v) { patchItem(key, { frame_variant_id: undefined, variantObj: undefined, description: '', unit_cost: 0 }); return }
    patchItem(key, {
      frame_variant_id: v.variant_id,
      variantObj: v,
      description: `${v.frame_master_ref?.brand ?? ''} ${v.frame_master_ref?.model_code ?? ''} / ${v.color} / ${v.eye_size}`.trim(),
      unit_cost: v.cost_price ?? 0,
    })
  }

  const setProduct = (key: string, productId: string) => {
    const product = products?.data.find((p) => p.product_id === productId)
    patchItem(key, {
      product_id: productId,
      description: product?.description || product?.name || '',
      unit_cost: product?.cost_price ?? 0,
    })
  }

  const handleProductCreated = (product?: Product) => {
    if (!product || !targetItemKey) return
    patchItem(targetItemKey, {
      product_id: product.product_id,
      description: product.description || product.name,
      unit_cost: product.cost_price,
    })
    setTargetItemKey(null)
    setProductPickerOpen(false)
  }

  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => suppliersApi.createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created successfully')
      onSuccess()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to create purchase order'),
  })

  const save = () => {
    if (!draft.supplier_id) return toast.error('Please select a supplier')
    if (!draft.shipping_address.trim()) return toast.error('Please fill delivery address')
    if (!draft.ship_to_location.trim()) return toast.error('Please fill ship to location')
    if (!draft.receiving_department.trim()) return toast.error('Please fill receiving department')

    for (const item of draft.items) {
      if (item.item_type === 'frame_variant' && !item.frame_variant_id)
        return toast.error('Select a frame variant for all lines or remove empty ones')
      if (item.item_type === 'product' && !item.product_id)
        return toast.error('Select a product for all lines or remove empty ones')
      if (item.quantity <= 0) return toast.error('Quantity must be greater than 0')
    }

    createMutation.mutate({
      supplier_id: draft.supplier_id,
      order_date: new Date(draft.order_date).toISOString(),
      expected_delivery_date: draft.expected_delivery_date ? new Date(draft.expected_delivery_date).toISOString() : undefined,
      items: draft.items.map(({ _key, variantObj, product_id, frame_variant_id, ...item }) => ({
        ...item,
        ...(product_id ? { product_id } : {}),
        ...(frame_variant_id ? { frame_variant_id } : {}),
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
      })),
      shipping_information: {
        delivery_address: draft.shipping_address || undefined,
        ship_to_location: draft.ship_to_location || undefined,
        receiving_department: draft.receiving_department || undefined,
        delivery_instructions: draft.delivery_instructions || undefined,
      },
      summary: { tax_rate: 0, shipping_cost: Number(draft.shipping_cost), discount: Number(draft.discount) },
      notes: { supplier_notes: draft.supplier_notes || undefined, internal_notes: draft.internal_notes || undefined },
    })
  }

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

          {/* General Information */}
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-foreground">General Information</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-muted-foreground"><span className="mr-1 text-error-500">*</span>Supplier</label>
                <select className="input" value={draft.supplier_id} onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value })}>
                  <option value="">Select an option</option>
                  {suppliers?.data.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-muted-foreground"><span className="mr-1 text-error-500">*</span>Order Date</label>
                <Input type="datetime-local" value={draft.order_date} onChange={(e) => setDraft({ ...draft, order_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Expected Delivery (optional)</label>
                <Input type="datetime-local" value={draft.expected_delivery_date} onChange={(e) => setDraft({ ...draft, expected_delivery_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Supplier Contact</label>
                <Input value={selectedSupplier?.phone || selectedSupplier?.email || ''} readOnly />
              </div>
              {selectedSupplier && (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Contact Person</label>
                    <Input value={selectedSupplier.contact_person || ''} readOnly />
                  </div>
                  <div className="md:col-span-4">
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Address</label>
                    <Input value={selectedSupplier.address || ''} readOnly />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Items */}
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Item Information</h4>
              <Button variant="outline" size="sm" onClick={() => setDraft((cur) => ({ ...cur, items: [...cur.items, blankItem()] }))}>
                <RiAddLine className="mr-1 h-4 w-4" />Add Item
              </Button>
            </div>

            {/* Column headers */}
            <div className="mb-1 hidden grid-cols-[120px_1fr_80px_110px_90px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
              <span>Type</span><span>Item</span><span>Qty</span><span>Unit Cost</span><span>Subtotal</span><span />
            </div>

            <div className="space-y-2">
              {draft.items.map((item) => {
                const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)
                const isVariant = item.item_type === 'frame_variant'

                return (
                  <div key={item._key} className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_80px_110px_90px_36px] md:items-center">

                      {/* Type toggle */}
                      <div className="flex rounded-md border border-border overflow-hidden text-xs h-8 shrink-0">
                        <button
                          type="button"
                          className={`flex-1 px-2 transition-colors ${isVariant ? 'bg-primary text-primary-foreground font-medium' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                          onClick={() => setItemType(item._key, 'frame_variant')}
                        >
                          Variant
                        </button>
                        <button
                          type="button"
                          className={`flex-1 px-2 transition-colors ${!isVariant ? 'bg-primary text-primary-foreground font-medium' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                          onClick={() => setItemType(item._key, 'product')}
                        >
                          Product
                        </button>
                      </div>

                      {/* Item picker */}
                      {isVariant ? (
                        <div className="min-w-0">
                          <VariantPicker
                            value={item.variantObj ?? null}
                            onChange={(v) => setVariant(item._key, v)}
                            showStock
                            showPrice={false}
                            placeholder="Search or scan variant…"
                          />
                        </div>
                      ) : (
                        <div className="flex min-w-0 gap-2">
                          <select
                            className="input flex-1 min-w-0"
                            value={item.product_id || ''}
                            onChange={(e) => setProduct(item._key, e.target.value)}
                          >
                            <option value="">Select product…</option>
                            {products?.data.map((p) => (
                              <option key={p.product_id} value={p.product_id}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted transition-colors h-9"
                            onClick={() => { setTargetItemKey(item._key); setProductPickerOpen(true) }}
                          >
                            + New
                          </button>
                        </div>
                      )}

                      {/* Qty */}
                      <input
                        type="number"
                        min={1}
                        className="input h-9 text-center"
                        value={item.quantity}
                        onChange={(e) => patchItem(item._key, { quantity: Number(e.target.value) })}
                      />

                      {/* Unit cost */}
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input h-9"
                        value={item.unit_cost}
                        onChange={(e) => patchItem(item._key, { unit_cost: Number(e.target.value) })}
                      />

                      {/* Subtotal */}
                      <span className="text-sm font-medium tabular-nums text-right hidden md:block">
                        {formatCurrency(lineSubtotal)}
                      </span>

                      {/* Remove */}
                      <button
                        type="button"
                        className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setDraft((cur) => {
                          const next = cur.items.filter((i) => i._key !== item._key)
                          return { ...cur, items: next.length ? next : [blankItem()] }
                        })}
                        title="Remove line"
                      >
                        <RiDeleteBinLine className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Description — shown below on a second row */}
                    <div className="mt-2 md:pl-[128px]">
                      <input
                        className="input h-8 w-full text-xs text-muted-foreground"
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) => patchItem(item._key, { description: e.target.value })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Amounts */}
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-foreground">Amounts</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Input label="Net Amount" value={formatCurrency(subtotal)} readOnly />
              <Input label="Shipping Cost" type="number" value={draft.shipping_cost} onChange={(e) => setDraft({ ...draft, shipping_cost: Number(e.target.value) })} />
              <Input label="Discount" type="number" value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) })} />
              <Input label="Total Gross" value={formatCurrency(gross)} readOnly />
            </div>
          </section>

          {/* Shipping */}
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-foreground">Shipping Information</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="* Delivery Address" value={draft.shipping_address} onChange={(e) => setDraft({ ...draft, shipping_address: e.target.value })} placeholder="Delivery Address" />
              <Input label="* Ship To Location" value={draft.ship_to_location} onChange={(e) => setDraft({ ...draft, ship_to_location: e.target.value })} placeholder="Ship To Location" />
              <Input label="* Receiving Department" value={draft.receiving_department} onChange={(e) => setDraft({ ...draft, receiving_department: e.target.value })} placeholder="Receiving Department" />
              <Input label="Delivery Instructions (optional)" value={draft.delivery_instructions} onChange={(e) => setDraft({ ...draft, delivery_instructions: e.target.value })} placeholder="Delivery instructions" />
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-foreground">Notes</h4>
            <div className="grid grid-cols-1 gap-4">
              <Input label="Supplier Notes" value={draft.supplier_notes} onChange={(e) => setDraft({ ...draft, supplier_notes: e.target.value })} placeholder="Notes visible to supplier" />
              <Input label="Internal Notes" value={draft.internal_notes} onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })} placeholder="Internal notes" />
            </div>
          </section>

        </div>
      </Modal>

      {productPickerOpen && targetItemKey && (
        <Modal
          isOpen={productPickerOpen}
          onClose={() => { setProductPickerOpen(false); setTargetItemKey(null) }}
          title="Add New Product"
          size="xl"
          className="z-[60]"
        >
          <AddProductAssistant
            isOpen={productPickerOpen}
            onClose={() => { setProductPickerOpen(false); setTargetItemKey(null) }}
            onSuccess={handleProductCreated}
            lockedSupplierId={draft.supplier_id || undefined}
          />
        </Modal>
      )}
    </>
  )
}

export default CreatePurchaseOrderAssistant
