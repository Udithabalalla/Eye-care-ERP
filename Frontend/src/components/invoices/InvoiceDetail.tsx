import { Invoice } from '@/types/invoice.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import {
  RiDownloadLine,
  RiMoneyDollarCircleLine,
  RiReceiptLine,
  RiUserLine,
  RiBox3Line,
  RiSparklingLine,
  RiCalendarLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'

interface InvoiceDetailProps {
  invoice: Invoice
  onPayment: () => void
  onDownloadPDF: () => void
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  pending: 'outline',
  overdue: 'destructive',
}

const lineTypeIcon = (type?: string) => {
  if (type === 'lens') return <RiSparklingLine className="h-3 w-3" />
  if (type === 'expense') return <RiReceiptLine className="h-3 w-3" />
  return <RiBox3Line className="h-3 w-3" />
}

const lineTypeLabel = (type?: string) => {
  if (type === 'lens') return 'Lens'
  if (type === 'expense') return 'Expense'
  return 'Frame'
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
)

const InvoiceDetail = ({ invoice, onPayment, onDownloadPDF }: InvoiceDetailProps) => {
  const isPaid = invoice.payment_status === 'paid'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h2>
            <Badge variant={statusVariant[invoice.payment_status] ?? 'outline'} className="capitalize">
              {invoice.payment_status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Issued {formatDate(invoice.invoice_date)}
            {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onDownloadPDF}>
            <RiDownloadLine className="size-4 mr-1.5" />
            PDF
          </Button>
          {!isPaid && (
            <Button size="sm" onClick={onPayment}>
              <RiMoneyDollarCircleLine className="size-4 mr-1.5" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Patient & SO info */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
        <div className="flex items-center gap-1.5 mb-2">
          <RiUserLine className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Patient</span>
        </div>
        <InfoRow label="Name" value={invoice.patient_name} />
        {invoice.patient_phone && <InfoRow label="Phone" value={invoice.patient_phone} />}
        {invoice.patient_email && <InfoRow label="Email" value={invoice.patient_email} />}
        {invoice.sales_order_id && (
          <InfoRow label="Sales Order" value={<span className="text-muted-foreground text-xs">{invoice.sales_order_id}</span>} />
        )}
      </div>

      {/* Items table */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Items</p>
        <div className="overflow-x-auto rounded-xl border border-border w-full">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-12 text-center">Qty</TableHead>
                <TableHead className="w-24 text-right">Unit Price</TableHead>
                <TableHead className="w-24 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{item.product_name}</span>
                      <span className="text-xs text-muted-foreground">{item.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-20">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground whitespace-nowrap">
                      {lineTypeIcon(item.line_type)}
                      {lineTypeLabel(item.line_type)}
                    </span>
                  </TableCell>
                  <TableCell className="w-12 text-center">{item.quantity}</TableCell>
                  <TableCell className="w-24 text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="w-24 text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-0.5">
        <InfoRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
        {(() => {
          const itemsDiscount = (invoice.items || []).reduce((s, it) => s + (it.discount || 0), 0)
          const totalDisc = invoice.total_discount || 0
          if (totalDisc > 0) {
            return <InfoRow label="Discount" value={<span className="text-destructive">-{formatCurrency(totalDisc)}</span>} />
          }
          if (itemsDiscount > 0) {
            return <InfoRow label="Discount" value={<span className="text-destructive">-{formatCurrency(itemsDiscount)}</span>} />
          }
          return null
        })()}
        {invoice.total_tax > 0 && (
          <InfoRow label="Tax" value={formatCurrency(invoice.total_tax)} />
        )}
        <Separator className="my-2" />
        <div className="flex items-center justify-between py-1">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(invoice.total_amount)}</span>
        </div>
        {invoice.paid_amount > 0 && (
          <InfoRow label="Paid" value={<span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(invoice.paid_amount)}</span>} />
        )}
        {invoice.balance_due > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="font-semibold text-foreground">Balance Due</span>
            <span className="text-lg font-bold text-destructive">{formatCurrency(invoice.balance_due)}</span>
          </div>
        )}
      </div>

      {/* Payment info */}
      {(invoice.payment_method || invoice.due_date) && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <RiCalendarLine className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Payment Details</span>
          </div>
          {invoice.due_date && <InfoRow label="Full Payment Due" value={formatDate(invoice.due_date)} />}
          {invoice.payment_method && (
            <InfoRow label="Method" value={<span className="capitalize">{invoice.payment_method}</span>} />
          )}
          {invoice.payment_date && (
            <InfoRow label="Paid On" value={formatDate(invoice.payment_date)} />
          )}
          {invoice.transaction_id && (
            <InfoRow label="Transaction ID" value={<span className="text-xs text-muted-foreground">{invoice.transaction_id}</span>} />
          )}
        </div>
      )}

      {invoice.notes && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
          <p className="text-sm text-foreground whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}

export default InvoiceDetail
