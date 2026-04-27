import { Invoice } from '@/types/invoice.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { getStatusColor } from '@/utils/helpers'
import { RiDownloadLine, RiMoneyDollarCircleLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'

interface InvoiceDetailProps {
  invoice: Invoice
  onPayment: () => void
  onDownloadPDF: () => void
}

const InvoiceDetail = ({ invoice, onPayment, onDownloadPDF }: InvoiceDetailProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{invoice.invoice_number}</h2>
          <p className="text-muted-foreground mt-1">
            Date: {formatDate(invoice.invoice_date)}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className={getStatusColor(invoice.payment_status)}>
            {invoice.payment_status}
          </Badge>
          <Button variant="outline" onClick={onDownloadPDF}>
            <RiDownloadLine className="w-4 h-4 mr-2" />
            PDF
          </Button>
          {invoice.balance_due > 0 && (
            <Button onClick={onPayment}>
              <RiMoneyDollarCircleLine className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
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

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <h3 className="text-lg font-semibold mb-3">Items</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell>{formatCurrency(item.discount)}</TableCell>
                  <TableCell>{formatCurrency(item.tax)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary p-4">
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

      {invoice.payment_method && (
        <div className="rounded-xl border border-border/60 bg-background p-4">
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
