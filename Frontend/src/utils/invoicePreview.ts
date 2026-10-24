import type { Invoice } from '@/types/invoice.types'
import type { InvoiceLineType, InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import { roundCurrency } from '@/utils/salesOrderCalculations'

// Same labels the printed PDF uses (backend invoice_service._build_invoice_pdf)
const LINE_TYPES: Record<string, InvoiceLineType> = {
  frame: 'Frame',
  lens: 'Lens',
  expense: 'Service',
  complimentary: 'Free',
  product: 'Product',
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
    total: invoice.total_amount,
    paid,
    balance: roundCurrency(Math.max(invoice.total_amount - paid, 0)),
    notes: invoice.notes,
  }
}
