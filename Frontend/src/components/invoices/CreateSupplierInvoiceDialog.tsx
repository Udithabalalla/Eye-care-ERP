import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import { Badge, Table } from '@/components/ui'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, SupplierInvoiceFormData, SupplierInvoiceItem } from '@/types/supplier.types'
import { formatCurrency } from '@/utils/formatters'

interface CreateSupplierInvoiceDialogProps {
  isOpen: boolean
  order: PurchaseOrder | null
  onClose: () => void
  onSuccess: () => void
}

const buildWarnings = (item: SupplierInvoiceItem, orderQuantities: { ordered: number; received: number }) => {
  const warnings: string[] = []
  if (item.invoice_quantity > orderQuantities.received) warnings.push('Invoice quantity exceeds received quantity.')
  if (item.invoice_quantity !== orderQuantities.ordered) warnings.push('Invoice quantity differs from purchase order quantity.')
  if (orderQuantities.ordered !== orderQuantities.received) warnings.push('Ordered quantity differs from received quantity.')
  return warnings
}

const CreateSupplierInvoiceDialog = ({ isOpen, order, onClose, onSuccess }: CreateSupplierInvoiceDialogProps) => {
  const queryClient = useQueryClient()
  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 100 }),
  })
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 16))
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState<SupplierInvoiceItem[]>([])

  useEffect(() => {
    if (!order) {
      setInvoiceNumber('')
      setItems([])
      return
    }

    const receiptItems = order.receipt_summary?.items || []
    const nextItems = order.items.map((item) => {
      const receiptItem = receiptItems.find((entry) => entry.product_id === item.product_id)
      const receivedQuantity = receiptItem?.received_quantity ?? item.quantity
      const product = products?.data.find((entry) => entry.product_id === item.product_id)

      return {
        product_id: item.product_id,
        product_name: product?.name || item.product_id,
        ordered_quantity: item.quantity,
        received_quantity: receivedQuantity,
        invoice_quantity: receivedQuantity,
        unit_price: item.unit_cost,
        line_total: Number((receivedQuantity * item.unit_cost).toFixed(2)),
        warnings: [],
      }
    })

    setItems(nextItems)
    setInvoiceNumber('')
    setInvoiceDate(new Date().toISOString().slice(0, 16))
    setDueDate('')
  }, [order, products?.data, isOpen])

  const matchingIssues = useMemo(() => {
    return items.flatMap((item) => buildWarnings(item, {
      ordered: item.ordered_quantity,
      received: item.received_quantity,
    }).map((warning) => `${item.product_id}: ${warning}`))
  }, [items])

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + Number((item.invoice_quantity * item.unit_price).toFixed(2)), 0)
  }, [items])

  const createMutation = useMutation({
    mutationFn: (data: SupplierInvoiceFormData) => suppliersApi.createSupplierInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success('Supplier invoice created successfully')
      onSuccess()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create supplier invoice'
      toast.error(message)
    },
  })

  const save = () => {
    if (!order) return
    if (!invoiceNumber.trim()) {
      toast.error('Invoice number is required')
      return
    }

    const payload: SupplierInvoiceFormData = {
      supplier_id: order.supplier_id,
      purchase_order_id: order.id,
      invoice_number: invoiceNumber.trim(),
      invoice_date: new Date(invoiceDate).toISOString(),
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      status: 'Unpaid',
      total_amount: totalAmount,
      items: items.map((item) => ({
        ...item,
        line_total: Number((item.invoice_quantity * item.unit_price).toFixed(2)),
        warnings: buildWarnings(item, { ordered: item.ordered_quantity, received: item.received_quantity }),
      })),
    }

    createMutation.mutate(payload)
  }

  if (!order) return null

  const matchingStatus = matchingIssues.length > 0 ? 'Flagged' : 'Matched'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Supplier Invoice - ${order.id}`}
      size="xl"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} isLoading={createMutation.isPending}>Create Invoice</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div><span className="font-medium text-secondary">Supplier:</span> {order.supplier_information?.supplier_name || order.supplier_id}</div>
            <div><span className="font-medium text-secondary">Purchase Order:</span> {order.id}</div>
            <div><span className="font-medium text-secondary">Match Status:</span> <Badge color={matchingStatus === 'Matched' ? 'success' : 'warning'} size="sm">{matchingStatus}</Badge></div>
          </div>
          {matchingIssues.length > 0 && (
            <div className="mt-3 rounded-apple border border-warning/30 bg-warning/10 p-3 text-sm text-warning-700">
              <p className="font-medium">Matching warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {matchingIssues.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Invoice Number" value={invoiceNumber} onChange={(value) => setInvoiceNumber(value.target.value)} placeholder="Enter supplier invoice number" />
          <Input label="Invoice Date" type="datetime-local" value={invoiceDate} onChange={(value) => setInvoiceDate(value.target.value)} />
          <Input label="Due Date" type="datetime-local" value={dueDate} onChange={(value) => setDueDate(value.target.value)} />
        </div>

        <div className="overflow-hidden rounded-apple-lg border border-border bg-bg-primary shadow-xs">
          <Table size="sm">
            <Table.Header bordered>
              <Table.Head label="Product" isRowHeader />
              <Table.Head label="Ordered" />
              <Table.Head label="Received" />
              <Table.Head label="Invoice Qty" />
              <Table.Head label="Unit Price" />
              <Table.Head label="Line Total" />
            </Table.Header>
            <Table.Body>
              {items.map((item, index) => {
                const warnings = buildWarnings(item, { ordered: item.ordered_quantity, received: item.received_quantity })
                return (
                  <Table.Row key={item.product_id}>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium text-primary">{item.product_name}</div>
                        <div className="text-xs text-tertiary">{item.product_id}</div>
                        {warnings.length > 0 && <Badge color="warning" size="sm">Flagged</Badge>}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{item.ordered_quantity}</Table.Cell>
                    <Table.Cell>{item.received_quantity}</Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        min={0}
                        value={item.invoice_quantity}
                        onChange={(event) => {
                          const next = [...items]
                          const invoiceQuantity = Number(event.target.value)
                          next[index] = {
                            ...next[index],
                            invoice_quantity: invoiceQuantity,
                            line_total: Number((invoiceQuantity * next[index].unit_price).toFixed(2)),
                          }
                          setItems(next)
                        }}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.unit_price}
                        onChange={(event) => {
                          const next = [...items]
                          const unitPrice = Number(event.target.value)
                          next[index] = {
                            ...next[index],
                            unit_price: unitPrice,
                            line_total: Number((next[index].invoice_quantity * unitPrice).toFixed(2)),
                          }
                          setItems(next)
                        }}
                      />
                    </Table.Cell>
                    <Table.Cell>{formatCurrency(item.line_total)}</Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        </div>

        <div className="rounded-apple border border-border bg-bg-secondary p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Total Amount</span>
            <span className="text-lg font-semibold text-primary">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default CreateSupplierInvoiceDialog