import type { Invoice } from '@/types/invoice.types'
import type { Payment } from '@/types/erp.types'
import type { InvoiceLineType, InvoicePaymentLine, InvoicePreviewData, InvoicePreviewLine } from '@/components/sales-orders/InvoicePreview'
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
 * An invoice's payments, oldest first, named the way the shop talks about them: the first is
 * the advance, the one that clears the balance is the full payment, any in between are part
 * payments. A single payment covering the whole total is "Paid in full".
 */
export const paymentLines = (payments: Pick<Payment, 'amount' | 'payment_date' | 'payment_method'>[], total: number): InvoicePaymentLine[] => {
  const ordered = [...payments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
  let paid = 0
  return ordered.map((payment, index) => {
    paid = roundCurrency(paid + payment.amount)
    const settles = paid >= roundCurrency(total) - 0.005
    const label = ordered.length === 1 && settles ? 'Paid in full' : index === 0 ? 'Advance payment' : settles ? 'Full payment' : 'Part payment'
    return { label, date: payment.payment_date, amount: payment.amount, method: payment.payment_method }
  })
}

/**
 * Turn a saved invoice into preview data. `extraPayment` previews the invoice as it will look
 * once that amount is recorded today; `payments` (the invoice's payment records) lists each
 * payment with its date.
 */
export const invoiceToPreviewData = (
  invoice: Invoice,
  extraPayment = 0,
  payments?: Pick<Payment, 'amount' | 'payment_date' | 'payment_method'>[],
  extraPaymentDate = new Date().toISOString(),
): InvoicePreviewData => {
  const paid = roundCurrency((invoice.paid_amount || 0) + Math.max(extraPayment, 0))
  const withExtra = payments && extraPayment > 0
    ? [...payments, { amount: extraPayment, payment_date: extraPaymentDate, payment_method: payments[0]?.payment_method }]
    : payments
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
    payments: withExtra ? paymentLines(withExtra as Pick<Payment, 'amount' | 'payment_date' | 'payment_method'>[], invoice.total_amount) : undefined,
    notes: invoice.notes,
  }
}
