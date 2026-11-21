import type { Invoice } from '@/types/invoice.types'
import type { InvoiceLineType, InvoicePreviewData, InvoicePreviewLine } from '@/components/sales-orders/InvoicePreview'
import { roundCurrency } from '@/utils/salesOrderCalculations'

// Same labels the printed PDF uses (backend invoice_service._build_invoice_pdf)
const LINE_TYPES: Record<string, InvoiceLineType> = {
  frame: 'Frame',
  lens: 'Lens',
  expense: 'Service',
  complimentary: 'Free',
  product: 'Product',
}

const sum = (lines: InvoicePreviewLine[], pick: (line: InvoicePreviewLine) => number) =>
  roundCurrency(lines.reduce((total, line) => total + pick(line), 0))

/**
 * The lines the customer sees on the invoice. The order card keeps the detail; the invoice
 * shows the glasses as one priced line:
 *  - new frame and new lenses → "Pair of spectacles"
 *  - the patient's own frame (no charge) with new lenses → "Pair of lenses"
 *  - a new frame with the patient's own lenses, or no lenses → "Frame (lenses OG)"
 * Services (fitting, coating, nose pads …) go into that line's total. Items bought from
 * inventory are listed on their own, and free items are left off.
 */
export const customerInvoiceLines = (lines: InvoicePreviewLine[]): InvoicePreviewLine[] => {
  const frames = lines.filter((line) => line.type === 'Frame')
  const lenses = lines.filter((line) => line.type === 'Lens')
  const services = lines.filter((line) => line.type === 'Service')
  const products = lines.filter((line) => line.type === 'Product')
  const newFrame = frames.some((line) => line.total > 0)
  const newLenses = lenses.some((line) => line.total > 0)
  const name = newFrame && newLenses ? 'Pair of spectacles' : newLenses ? 'Pair of lenses' : newFrame ? 'Frame (lenses OG)' : null
  // No glasses on the order (a repair, say): its services are listed as they are
  if (!name) return [...services, ...products]

  const grouped = [...frames, ...lenses, ...services]
  const total = sum(grouped, (line) => line.total)
  const discount = sum(grouped, (line) => line.discount)
  return [
    { key: 'glasses', name, type: newLenses ? 'Lens' : 'Frame', grouped: true, qty: 1, unitPrice: roundCurrency(total + discount), discount, total },
    ...products,
  ]
}

/**
 * Turn a saved invoice into preview data. `extraPayment` previews the invoice
 * as it will look once that amount is recorded.
 */
export const invoiceToPreviewData = (invoice: Invoice, extraPayment = 0): InvoicePreviewData => {
  const paid = roundCurrency((invoice.paid_amount || 0) + Math.max(extraPayment, 0))
  return {
    invoiceNumber: invoice.invoice_number,
    salesOrderNumber: invoice.sales_order_id,
    salesOrderId: invoice.sales_order_id || undefined,
    prescriptionRef: invoice.prescription_id && invoice.prescription_id !== 'string' ? invoice.prescription_id : undefined,
    issueDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    billTo: { name: invoice.patient_name, phone: invoice.patient_phone, email: invoice.patient_email },
    lines: invoice.items.map((item, index) => ({
      key: `${item.product_id}-${index}`,
      name: item.product_name,
      detail: item.sku,
      type: LINE_TYPES[(item.line_type as string) || 'product'] ?? 'Product',
      qty: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount || 0,
      total: item.total,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.total_discount || 0,
    tax: invoice.total_tax || 0,
    total: invoice.total_amount,
    paid,
    balance: roundCurrency(Math.max(invoice.total_amount - paid, 0)),
    notes: invoice.notes,
  }
}
