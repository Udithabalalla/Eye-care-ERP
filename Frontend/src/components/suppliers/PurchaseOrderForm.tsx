import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { companyProfileApi } from '@/api/company-profile.api'
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
  const { data: companyProfile } = useQuery({ queryKey: ['company-profile'], queryFn: () => companyProfileApi.get() })
  const [form, setForm] = useState<PurchaseOrderFormData>({
    supplier_id: '',
    order_date: new Date().toISOString(),
    items: [{ product_id: '', quantity: 1, unit_cost: 0 }],
    shipping_information: {
      ship_to_location: '',
      delivery_address: '',
      receiving_department: '',
      delivery_instructions: '',
    },
    summary: {
      tax_rate: 0,
      shipping_cost: 0,
      discount: 0,
    },
    payment_terms: {
      payment_terms: '',
      payment_method: '',
      currency: 'LKR',
    },
    notes: {
      supplier_notes: '',
      internal_notes: '',
    },
    footer: {
      company_policy_note: '',
      contact_information: '',
    },
  })

  useEffect(() => {
    const buyerInformation = order?.buyer_information ? order.buyer_information : (companyProfile ? {
      company_name: companyProfile.company_name,
      company_logo: companyProfile.company_logo || 'Logo.png',
      company_address: companyProfile.address,
      phone: companyProfile.phone,
      email: companyProfile.email,
      tax_number: companyProfile.tax_number,
    } : undefined)
    const shippingInformation = order?.shipping_information || {
      ship_to_location: '',
      delivery_address: '',
      receiving_department: '',
      delivery_instructions: '',
    }
    const summary = order?.order_summary || {
      subtotal: 0,
      line_discount_total: 0,
      tax_rate: 0,
      tax_amount: 0,
      shipping_cost: 0,
      discount: 0,
      total_amount: 0,
    }
    const paymentTerms = order?.payment_terms || {
      payment_terms: '',
      payment_method: '',
      currency: 'LKR',
    }
    const notes = order?.notes || {
      supplier_notes: '',
      internal_notes: '',
    }
    const footer = order?.footer || {
      company_policy_note: '',
      contact_information: '',
    }

    if (order) {
      setForm({
        supplier_id: order.supplier_id,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date,
        items: order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, unit_cost: item.unit_cost })),
        buyer_information: buyerInformation,
        shipping_information: shippingInformation,
        summary,
        payment_terms: paymentTerms,
        notes,
        footer,
      })
    } else if (buyerInformation) {
      setForm((current) => ({
        ...current,
        buyer_information: buyerInformation,
        shipping_information: shippingInformation,
        summary,
        payment_terms: paymentTerms,
        notes,
        footer,
      }))
    }
  }, [order, companyProfile])

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
  const taxRate = form.summary?.tax_rate || 0
  const shippingCost = form.summary?.shipping_cost || 0
  const discount = form.summary?.discount || 0
  const summarySubtotal = totalAmount
  const summaryTax = Math.max(0, (summarySubtotal - discount) * taxRate)
  const summaryTotal = Math.max(0, summarySubtotal - discount + summaryTax + shippingCost)

  const readonlySections = order ? [
    {
      title: 'Buyer Information',
      rows: [
        ['Company Name', order.buyer_information?.company_name || '-'],
        ['Logo', order.buyer_information?.company_logo || '-'],
        ['Address', order.buyer_information?.company_address || '-'],
        ['Phone', order.buyer_information?.phone || '-'],
        ['Email', order.buyer_information?.email || '-'],
        ['Tax Number', order.buyer_information?.tax_number || '-'],
      ],
    },
    {
      title: 'Supplier Information',
      rows: [
        ['Supplier ID', order.supplier_information?.supplier_id || order.supplier_id || '-'],
        ['Supplier Name', order.supplier_information?.supplier_name || '-'],
        ['Company Name', order.supplier_information?.company_name || '-'],
        ['Contact Person', order.supplier_information?.contact_person || '-'],
        ['Phone', order.supplier_information?.phone || '-'],
        ['Email', order.supplier_information?.email || '-'],
        ['Address', order.supplier_information?.address || '-'],
      ],
    },
    {
      title: 'Shipping Information',
      rows: [
        ['Ship To Location', order.shipping_information?.ship_to_location || '-'],
        ['Delivery Address', order.shipping_information?.delivery_address || '-'],
        ['Receiving Department', order.shipping_information?.receiving_department || '-'],
        ['Delivery Instructions', order.shipping_information?.delivery_instructions || '-'],
      ],
    },
    {
      title: 'Order Summary',
      rows: [
        ['Subtotal', String(order.order_summary?.subtotal ?? totalAmount)],
        ['Line Discount Total', String(order.order_summary?.line_discount_total ?? 0)],
        ['Tax Rate', String(order.order_summary?.tax_rate ?? 0)],
        ['Tax Amount', String(order.order_summary?.tax_amount ?? 0)],
        ['Shipping Cost', String(order.order_summary?.shipping_cost ?? 0)],
        ['Discount', String(order.order_summary?.discount ?? 0)],
        ['Total Amount', String(order.order_summary?.total_amount ?? order.total_amount)],
      ],
    },
    {
      title: 'Payment Terms',
      rows: [
        ['Payment Terms', order.payment_terms?.payment_terms || '-'],
        ['Payment Method', order.payment_terms?.payment_method || '-'],
        ['Currency', order.payment_terms?.currency || '-'],
      ],
    },
    {
      title: 'Notes',
      rows: [
        ['Supplier Notes', order.notes?.supplier_notes || '-'],
        ['Internal Notes', order.notes?.internal_notes || '-'],
      ],
    },
    {
      title: 'Footer',
      rows: [
        ['Company Policy Note', order.footer?.company_policy_note || '-'],
        ['Contact Information', order.footer?.contact_information || '-'],
      ],
    },
  ] : []

  const save = () => {
    if (!form.supplier_id) { toast.error('Please select a supplier'); return }
    const hasInvalidItem = form.items.some(i => !i.product_id || i.quantity <= 0 || i.unit_cost < 0)
    if (hasInvalidItem) { toast.error('Please fill all item fields properly'); return }
    // Send null for empty delivery date (not empty string which causes 422)
    const payload: PurchaseOrderFormData = {
      ...form,
      expected_delivery_date: form.expected_delivery_date || undefined,
    }
    if (order) {
      if (order.status !== 'Draft') {
        toast.error('Approved purchase orders are locked')
        return
      }
      updateStatus.mutate('Approved')
    }
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
          <Button onClick={save} isLoading={createMutation.isPending || updateStatus.isPending} disabled={Boolean(order?.is_locked)}> 
            {order ? (order.status === 'Draft' ? 'Approve' : 'Locked') : 'Save'}
          </Button>
        </div>
      )}
    >
      {order && (
        <div className="mb-6 space-y-4 rounded-lg border border-border bg-surface/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-secondary">
            <div><span className="font-medium text-primary">Order ID:</span> {order.id}</div>
            <div><span className="font-medium text-primary">Status:</span> {order.status}</div>
            <div><span className="font-medium text-primary">Created By:</span> {order.created_by}</div>
            <div><span className="font-medium text-primary">Locked:</span> {order.is_locked ? 'Yes' : 'No'}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {readonlySections.map((section) => (
              <div key={section.title} className="rounded-md border border-border bg-white p-4 shadow-sm">
                <h4 className="mb-3 font-semibold text-primary">{section.title}</h4>
                <div className="space-y-2 text-sm">
                  {section.rows.map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                      <span className="font-medium text-secondary">{label}</span>
                      <span className="text-primary sm:text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {order.authorization && (
            <div className="rounded-md border border-border bg-white p-4 shadow-sm">
              <h4 className="mb-3 font-semibold text-primary">Authorization</h4>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div><span className="font-medium text-secondary">Approved By:</span> {order.authorization.approved_by || '-'}</div>
                <div><span className="font-medium text-secondary">Approval Date:</span> {order.authorization.approval_date || '-'}</div>
                <div><span className="font-medium text-secondary">Signature File:</span> {order.authorization.signature || '-'}</div>
              </div>
            </div>
          )}
        </div>
      )}

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
        <Input label="Expected Delivery Date" type="datetime-local" value={form.expected_delivery_date ? form.expected_delivery_date.slice(0, 16) : ''} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
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
        <p className="text-sm text-secondary">Items Total: {totalAmount.toFixed(2)}</p>
        {order?.status === 'Approved' && (
          <p className="text-sm font-medium text-success-600">This purchase order is approved and locked.</p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Shipping Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Ship To Location" value={form.shipping_information?.ship_to_location || ''} onChange={(e) => setForm({ ...form, shipping_information: { ...(form.shipping_information || {}), ship_to_location: e.target.value } })} />
          <Input label="Delivery Address" value={form.shipping_information?.delivery_address || ''} onChange={(e) => setForm({ ...form, shipping_information: { ...(form.shipping_information || {}), delivery_address: e.target.value } })} />
          <Input label="Receiving Department" value={form.shipping_information?.receiving_department || ''} onChange={(e) => setForm({ ...form, shipping_information: { ...(form.shipping_information || {}), receiving_department: e.target.value } })} />
          <Input label="Delivery Instructions" value={form.shipping_information?.delivery_instructions || ''} onChange={(e) => setForm({ ...form, shipping_information: { ...(form.shipping_information || {}), delivery_instructions: e.target.value } })} />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Order Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Tax Rate" type="number" step="0.0001" value={form.summary?.tax_rate ?? 0} onChange={(e) => setForm({ ...form, summary: { ...(form.summary || {}), tax_rate: Number(e.target.value) } })} />
          <Input label="Shipping Cost" type="number" step="0.01" value={form.summary?.shipping_cost ?? 0} onChange={(e) => setForm({ ...form, summary: { ...(form.summary || {}), shipping_cost: Number(e.target.value) } })} />
          <Input label="Discount" type="number" step="0.01" value={form.summary?.discount ?? 0} onChange={(e) => setForm({ ...form, summary: { ...(form.summary || {}), discount: Number(e.target.value) } })} />
          <Input label="Tax Amount (preview)" type="number" value={summaryTax.toFixed(2)} readOnly />
        </div>
        <p className="text-sm text-secondary">Summary Total: {summaryTotal.toFixed(2)}</p>
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Payment Terms</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Payment Terms" value={form.payment_terms?.payment_terms || ''} onChange={(e) => setForm({ ...form, payment_terms: { ...(form.payment_terms || {}), payment_terms: e.target.value } })} />
          <Input label="Payment Method" value={form.payment_terms?.payment_method || ''} onChange={(e) => setForm({ ...form, payment_terms: { ...(form.payment_terms || {}), payment_method: e.target.value } })} />
          <Input label="Currency" value={form.payment_terms?.currency || 'LKR'} onChange={(e) => setForm({ ...form, payment_terms: { ...(form.payment_terms || {}), currency: e.target.value } })} />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Notes</h4>
        <Input label="Supplier Notes" value={form.notes?.supplier_notes || ''} onChange={(e) => setForm({ ...form, notes: { ...(form.notes || {}), supplier_notes: e.target.value } })} />
        <Input label="Internal Notes" value={form.notes?.internal_notes || ''} onChange={(e) => setForm({ ...form, notes: { ...(form.notes || {}), internal_notes: e.target.value } })} />
      </div>

      <div className="mt-6 space-y-3">
        <h4 className="font-semibold text-primary">Footer</h4>
        <Input label="Company Policy Note" value={form.footer?.company_policy_note || ''} onChange={(e) => setForm({ ...form, footer: { ...(form.footer || {}), company_policy_note: e.target.value } })} />
        <Input label="Contact Information" value={form.footer?.contact_information || ''} onChange={(e) => setForm({ ...form, footer: { ...(form.footer || {}), contact_information: e.target.value } })} />
      </div>

      {order?.authorization && (
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold text-primary">Authorization</h4>
          <div className="rounded border border-border p-4 text-sm text-secondary space-y-1">
            <div>Approved By: {order.authorization.approved_by || '-'}</div>
            <div>Approval Date: {order.authorization.approval_date || '-'}</div>
            <div>Signature File: {order.authorization.signature || '-'}</div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default PurchaseOrderForm
