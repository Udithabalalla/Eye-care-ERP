import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem } from '@/components/ui'
import Loading from '@/components/common/Loading'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { salesOrdersApi } from '@/api/erp.api'
import { patientsApi } from '@/api/patients.api'
import { productsApi } from '@/api/products.api'
import { SalesOrder, SalesOrderStatus } from '@/types/erp.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const statusOptions: Array<{ id: string; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

interface SalesOrderFormItem {
  product_id: string
  barcode: string
  quantity: number
  unit_price: number
}

interface SalesOrderFormState {
  patient_id: string
  prescription_id: string
  tested_by: string
  expected_delivery_date: string
  measurements: {
    pd: string
    fitting_height: string
    segment_height: string
  }
  notes: string
  status: SalesOrderStatus
  items: SalesOrderFormItem[]
}

const defaultForm: SalesOrderFormState = {
  patient_id: '',
  prescription_id: '',
  tested_by: '',
  expected_delivery_date: '',
  measurements: {
    pd: '',
    fitting_height: '',
    segment_height: '',
  },
  notes: '',
  status: 'draft',
  items: [{ product_id: '', barcode: '', quantity: 1, unit_price: 0 }],
}

const SalesOrders = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SalesOrderStatus | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [form, setForm] = useState<SalesOrderFormState>(defaultForm)
  const [barcodeLookupIndex, setBarcodeLookupIndex] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', search, status],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 100, status: status || undefined }),
  })

  const { data: patientsData } = useQuery({
    queryKey: ['sales-order-patients-lookup'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100, search: '' }),
  })

  const { data: productsData } = useQuery({
    queryKey: ['sales-order-products-lookup'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100, search: '' }),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: SalesOrderFormState) => {
      const items = payload.items.map((item) => {
        const product = (productsData?.data || []).find((p) => p.product_id === item.product_id)
        return {
          product_id: item.product_id,
          product_name: product?.name,
          sku: product?.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: Number((item.quantity * item.unit_price).toFixed(2)),
        }
      })

      const request = {
        patient_id: payload.patient_id,
        prescription_id: payload.prescription_id || undefined,
        tested_by: payload.tested_by || undefined,
        expected_delivery_date: payload.expected_delivery_date || undefined,
        measurements: {
          pd: payload.measurements.pd || undefined,
          fitting_height: payload.measurements.fitting_height || undefined,
          segment_height: payload.measurements.segment_height || undefined,
        },
        notes: payload.notes || undefined,
        status: payload.status,
        items,
      }

      if (editingOrder) {
        return salesOrdersApi.update(editingOrder.order_id, request)
      }
      return salesOrdersApi.create(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setIsModalOpen(false)
      setEditingOrder(null)
      setForm(defaultForm)
      toast.success(editingOrder ? 'Sales order updated' : 'Sales order created')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to save sales order'
      toast.error(message)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ orderId, nextStatus }: { orderId: string; nextStatus: SalesOrderStatus }) => salesOrdersApi.updateStatus(orderId, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Sales order status updated')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to update status'
      toast.error(message)
    },
  })

  const convertMutation = useMutation({
    mutationFn: (orderId: string) => salesOrdersApi.generateInvoice(orderId),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`Invoice ${invoice.invoice_number} generated from sales order`)
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to generate invoice'
      toast.error(message)
    },
  })

  const rows = (data?.data || []).filter((order) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    const patientName = order.patient_name || ''
    return [order.order_number, order.patient_id, patientName, order.prescription_id || '']
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  const patientNameMap = useMemo(() => {
    const lookup: Record<string, string> = {}
    ;(patientsData?.data || []).forEach((patient) => {
      lookup[patient.patient_id] = patient.name
    })
    return lookup
  }, [patientsData])

  const formSubtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [form.items]
  )

  const openCreate = () => {
    setEditingOrder(null)
    setForm(defaultForm)
    setIsModalOpen(true)
  }

  const openEdit = (order: SalesOrder) => {
    setEditingOrder(order)
    setForm({
      patient_id: order.patient_id,
      prescription_id: order.prescription_id || '',
      tested_by: order.tested_by || '',
      expected_delivery_date: order.expected_delivery_date ? String(order.expected_delivery_date).split('T')[0] : '',
      measurements: {
        pd: String(order.measurements?.pd ?? ''),
        fitting_height: String(order.measurements?.fitting_height ?? ''),
        segment_height: String(order.measurements?.segment_height ?? ''),
      },
      notes: order.notes || '',
      status: order.status,
      items: order.items.map((item) => ({
        product_id: item.product_id,
        barcode: item.sku || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    })
    setIsModalOpen(true)
  }

  const handleItemChange = (index: number, key: keyof SalesOrderFormItem, value: string | number) => {
    setForm((current) => {
      const nextItems = [...current.items]
      const existing = nextItems[index]
      const updated = { ...existing, [key]: value }

      if (key === 'product_id') {
        const product = (productsData?.data || []).find((p) => p.product_id === value)
        if (product) {
          updated.barcode = product.barcode || product.sku || ''
          updated.unit_price = product.selling_price
        }
      }

      nextItems[index] = updated
      return { ...current, items: nextItems }
    })
  }

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, { product_id: '', barcode: '', quantity: 1, unit_price: 0 }],
    }))
  }

  const removeItem = (index: number) => {
    setForm((current) => {
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        items: nextItems.length ? nextItems : [{ product_id: '', barcode: '', quantity: 1, unit_price: 0 }],
      }
    })
  }

  const applyBarcode = async (index: number) => {
    const code = form.items[index]?.barcode?.trim()
    if (!code) {
      toast.error('Enter a barcode/SKU/product ID first')
      return
    }

    setBarcodeLookupIndex(index)
    try {
      const product = await productsApi.lookupByCode(code)
      setForm((current) => {
        const nextItems = [...current.items]
        const existing = nextItems[index]
        if (!existing) return current
        nextItems[index] = {
          ...existing,
          product_id: product.product_id,
          barcode: code,
          unit_price: product.selling_price,
        }
        return { ...current, items: nextItems }
      })
      toast.success(`Added ${product.name}`)
    } catch {
      toast.error('Product not found for this barcode/SKU')
    } finally {
      setBarcodeLookupIndex(null)
    }
  }

  const handleSave = () => {
    if (!form.patient_id) {
      toast.error('Patient is required')
      return
    }

    if (!form.items.length || form.items.some((item) => !item.product_id || item.quantity <= 0 || item.unit_price < 0)) {
      toast.error('Add at least one valid line item')
      return
    }

    saveMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Sales Orders"
          badge={rows.length}
          description="Track customer commitments before billing"
          contentTrailing={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search sales orders..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <Select selectedKey={status || 'all'} onSelectionChange={(key) => setStatus(key === 'all' ? '' : String(key) as SalesOrderStatus)} placeholder="Status">
                <SelectItem id="all">All Statuses</SelectItem>
                {statusOptions.map((option) => <SelectItem key={option.id} id={option.id}>{option.label}</SelectItem>)}
              </Select>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create Sales Order
              </Button>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Sales orders table">
            <Table.Header>
              <Table.Head label="Order #" isRowHeader />
              <Table.Head label="Patient" />
              <Table.Head label="Items" />
              <Table.Head label="Total" />
              <Table.Head label="Prescription" />
              <Table.Head label="Status" />
              <Table.Head label="Created" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {rows.map((order) => (
                <Table.Row key={order.order_id}>
                  <Table.Cell>{order.order_number}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span>{order.patient_name || patientNameMap[order.patient_id] || order.patient_id}</span>
                      <span className="text-xs text-tertiary">{order.patient_id}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{order.items.length}</Table.Cell>
                  <Table.Cell>{formatCurrency(order.total_amount || order.subtotal || 0)}</Table.Cell>
                  <Table.Cell>{order.prescription_id || '-'}</Table.Cell>
                  <Table.Cell>{order.status}</Table.Cell>
                  <Table.Cell>{formatDate(order.created_at)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(order)}
                        disabled={order.status === 'completed' || order.status === 'cancelled'}
                      >
                        Edit
                      </Button>
                      <select
                        className="input h-8 min-w-[160px] text-xs"
                        value={order.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as SalesOrderStatus
                          if (nextStatus !== order.status) {
                            statusMutation.mutate({ orderId: order.order_id, nextStatus })
                          }
                        }}
                        disabled={statusMutation.isPending || order.status === 'completed' || order.status === 'cancelled'}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                      {['confirmed', 'in_production', 'ready', 'completed'].includes(order.status) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => convertMutation.mutate(order.order_id)}
                          disabled={Boolean(order.invoice_id) || convertMutation.isPending}
                        >
                          {order.invoice_id ? 'Invoiced' : 'Generate Invoice'}
                        </Button>
                      )}
                      {order.invoice_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate('/invoices')}
                        >
                          View Invoice
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingOrder(null)
          setForm(defaultForm)
        }}
        title={editingOrder ? 'Edit Sales Order' : 'Create Sales Order'}
        size="xl"
        footer={(
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false)
                setEditingOrder(null)
                setForm(defaultForm)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saveMutation.isPending}>
              {editingOrder ? 'Update Sales Order' : 'Create Sales Order'}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Patient</label>
              <select
                className="input w-full"
                value={form.patient_id}
                onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))}
              >
                <option value="">Select patient</option>
                {(patientsData?.data || []).map((patient) => (
                  <option key={patient.patient_id} value={patient.patient_id}>
                    {patient.name} ({patient.patient_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Status</label>
              <select
                className="input w-full"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SalesOrderStatus }))}
              >
                {statusOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Prescription ID (optional)</label>
              <input
                className="input w-full"
                value={form.prescription_id}
                onChange={(event) => setForm((current) => ({ ...current, prescription_id: event.target.value }))}
                placeholder="PRE000001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Tested By (optional)</label>
              <input
                className="input w-full"
                value={form.tested_by}
                onChange={(event) => setForm((current) => ({ ...current, tested_by: event.target.value }))}
                placeholder="Optometrist / Staff"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Expected Delivery Date (optional)</label>
              <input
                type="date"
                className="input w-full"
                value={form.expected_delivery_date}
                onChange={(event) => setForm((current) => ({ ...current, expected_delivery_date: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Notes</label>
              <input
                className="input w-full"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Any notes for this order"
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-primary mb-3">Optical Measurements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">PD</label>
                <input
                  className="input w-full"
                  value={form.measurements.pd}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, pd: event.target.value },
                  }))}
                  placeholder="e.g. 63"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Fitting Height</label>
                <input
                  className="input w-full"
                  value={form.measurements.fitting_height}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, fitting_height: event.target.value },
                  }))}
                  placeholder="e.g. 18"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Segment Height</label>
                <input
                  className="input w-full"
                  value={form.measurements.segment_height}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    measurements: { ...current.measurements, segment_height: event.target.value },
                  }))}
                  placeholder="e.g. 16"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>Add Item</Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end rounded-lg border border-border p-3">
                  <div className="md:col-span-5">
                    <label className="block text-xs text-tertiary mb-1">Product</label>
                    <select
                      className="input w-full"
                      value={item.product_id}
                      onChange={(event) => handleItemChange(index, 'product_id', event.target.value)}
                    >
                      <option value="">Select product</option>
                      {(productsData?.data || []).map((product) => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.name} ({product.product_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-tertiary mb-1">Barcode / SKU</label>
                    <div className="flex gap-2">
                      <input
                        className="input w-full"
                        value={item.barcode}
                        onChange={(event) => handleItemChange(index, 'barcode', event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            applyBarcode(index)
                          }
                        }}
                        placeholder="Scan or type code"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBarcode(index)}
                        isLoading={barcodeLookupIndex === index}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="input w-full"
                      value={item.quantity}
                      onChange={(event) => handleItemChange(index, 'quantity', Number(event.target.value || 0))}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Unit Price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input w-full"
                      value={item.unit_price}
                      onChange={(event) => handleItemChange(index, 'unit_price', Number(event.target.value || 0))}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-tertiary mb-1">Line Total</label>
                    <div className="h-10 rounded-lg border border-border px-3 flex items-center bg-secondary">{formatCurrency(item.quantity * item.unit_price)}</div>
                  </div>
                  <div className="md:col-span-1">
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <div className="text-right">
                <div className="text-sm text-tertiary">Subtotal</div>
                <div className="text-lg font-bold text-primary">{formatCurrency(formSubtotal)}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SalesOrders