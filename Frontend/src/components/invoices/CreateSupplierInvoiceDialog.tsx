import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from '@/components/common/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RiLoader4Line } from '@remixicon/react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrder, SupplierInvoice, SupplierInvoiceFormData, SupplierInvoiceItem } from '@/types/supplier.types'
import { formatCurrency } from '@/utils/formatters'

interface CreateSupplierInvoiceDialogProps {
  isOpen: boolean
  order: PurchaseOrder | null
  onClose: () => void
  onSuccess: (invoice: SupplierInvoice) => void
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
    setDueDate(order.expected_delivery_date ? new Date(order.expected_delivery_date).toISOString().slice(0, 16) : '')
  }, [order, products?.data, isOpen])

  const matchingIssues = useMemo(() => {
    return items.flatMap((item) =>
      buildWarnings(item, { ordered: item.ordered_quantity, received: item.received_quantity })
        .map((warning) => `${item.product_name}: ${warning}`)
    )
  }, [items])

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + Number((item.invoice_quantity * item.unit_price).toFixed(2)), 0)
  }, [items])

  const createMutation = useMutation({
    mutationFn: (data: SupplierInvoiceFormData) => suppliersApi.createSupplierInvoice(data),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success('Supplier invoice created successfully')
      onSuccess(invoice)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create supplier invoice')
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

  const isMatched = matchingIssues.length === 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Supplier Invoice — ${order.id}`}
      size="xl"
      footer={(
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button onClick={save} disabled={createMutation.isPending}>
            {createMutation.isPending && <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Order summary */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div>
              <span className="font-medium text-muted-foreground">Supplier: </span>
              {order.supplier_information?.supplier_name || order.supplier_id}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Purchase Order: </span>
              {order.id}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">Match Status:</span>
              <Badge variant={isMatched ? 'default' : 'secondary'}>
                {isMatched ? 'Matched' : 'Flagged'}
              </Badge>
            </div>
          </div>

          {matchingIssues.length > 0 && (
            <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-3 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-300">Matching warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-yellow-700 dark:text-yellow-400">
                {matchingIssues.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Invoice header fields */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-number">Invoice Number <span className="text-destructive">*</span></Label>
            <Input
              id="inv-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter supplier invoice number"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-date">Invoice Date</Label>
            <Input
              id="inv-date"
              type="datetime-local"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-due">Due Date</Label>
            <Input
              id="inv-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Line items table */}
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Received</TableHead>
                <TableHead className="text-center">Invoice Qty</TableHead>
                <TableHead className="text-center">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const warnings = buildWarnings(item, { ordered: item.ordered_quantity, received: item.received_quantity })
                return (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{item.product_name}</div>
                        <div className="text-xs text-muted-foreground">{item.product_id}</div>
                        {warnings.length > 0 && <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">Flagged</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.ordered_quantity}</TableCell>
                    <TableCell className="text-center">{item.received_quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-sm text-center"
                        value={item.invoice_quantity}
                        onChange={(e) => {
                          const next = [...items]
                          const invoiceQuantity = Number(e.target.value)
                          next[index] = { ...next[index], invoice_quantity: invoiceQuantity, line_total: Number((invoiceQuantity * next[index].unit_price).toFixed(2)) }
                          setItems(next)
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="h-8 text-sm text-center"
                        value={item.unit_price}
                        onChange={(e) => {
                          const next = [...items]
                          const unitPrice = Number(e.target.value)
                          next[index] = { ...next[index], unit_price: unitPrice, line_total: Number((next[index].invoice_quantity * unitPrice).toFixed(2)) }
                          setItems(next)
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Total */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default CreateSupplierInvoiceDialog
