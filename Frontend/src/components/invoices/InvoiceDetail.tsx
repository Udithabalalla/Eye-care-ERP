import { Invoice } from '@/types/invoice.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { getStatusColor } from '@/utils/helpers'
import { Download01, CurrencyDollar } from '@untitledui/icons'

interface InvoiceDetailProps {
  invoice: Invoice
  onPayment: () => void
  onDownloadPDF: () => void
}

const InvoiceDetail = ({ invoice, onPayment, onDownloadPDF }: InvoiceDetailProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{invoice.invoice_number}</h2>
          <p className="text-muted-foreground mt-1">
            Date: {formatDate(invoice.invoice_date)}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`badge ${getStatusColor(invoice.payment_status)}`}>
            {invoice.payment_status}
          </span>
          <button onClick={onDownloadPDF} className="btn-secondary">
            <Download01 className="w-4 h-4 mr-2" />
            PDF
          </button>
          {invoice.balance_due > 0 && (
            <button onClick={onPayment} className="btn-primary">
              <CurrencyDollar className="w-4 h-4 mr-2" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Patient Info */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Patient Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span>
            <span className="ml-2 font-medium">{invoice.patient_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Phone:</span>
            <span className="ml-2 font-medium">{invoice.patient_phone}</span>
          </div>
          {invoice.patient_email && (
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-2 font-medium">{invoice.patient_email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Items</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.product_name}</td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.discount)}</td>
                  <td>{formatCurrency(item.tax)}</td>
                  <td className="font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="card bg-secondary">
        <div className="max-w-md ml-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Discount:</span>
            <span className="font-medium text-error-600">
              -{formatCurrency(invoice.total_discount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Tax:</span>
            <span className="font-medium">{formatCurrency(invoice.total_tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total Amount:</span>
            <span className="text-primary">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid Amount:</span>
            <span className="font-medium text-success-600">
              {formatCurrency(invoice.paid_amount)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Balance Due:</span>
            <span className="text-error-600">{formatCurrency(invoice.balance_due)}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {invoice.payment_method && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Payment Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Method:</span>
              <span className="ml-2 font-medium capitalize">{invoice.payment_method}</span>
            </div>
            {invoice.payment_date && (
              <div>
                <span className="text-muted-foreground">Payment Date:</span>
                <span className="ml-2 font-medium">{formatDate(invoice.payment_date)}</span>
              </div>
            )}
            {invoice.transaction_id && (
              <div>
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="ml-2 font-medium">{invoice.transaction_id}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoiceDetail






