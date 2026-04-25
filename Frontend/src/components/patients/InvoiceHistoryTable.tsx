import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/utils/formatters'
import type { Invoice } from '@/types/invoice.types'

interface InvoiceHistoryTableProps {
  invoices: Invoice[]
}

const formatAmount = (value: number): string => {
  return new Intl.NumberFormat('en-LK', {
    maximumFractionDigits: 0,
  }).format(value)
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  pending: 'outline',
  overdue: 'destructive',
}

const InvoiceHistoryTable = ({ invoices }: InvoiceHistoryTableProps) => {
  if (!invoices.length) {
    return <p className="py-4 px-4 text-sm text-muted-foreground">No invoice history found.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice ID</TableHead>
          <TableHead>Product/s</TableHead>
          <TableHead>Date of Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Total (LKR)</TableHead>
          <TableHead>Remaining (LKR)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const productNames = Array.from(new Set(invoice.items.map((item) => item.product_name))).join(', ')
          const totalQuantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0)

          return (
            <TableRow key={invoice.invoice_id}>
              <TableCell>
                <span className="font-medium text-primary">{invoice.invoice_number}</span>
              </TableCell>
              <TableCell className="max-w-[220px] truncate">{productNames}</TableCell>
              <TableCell>{formatDate(invoice.invoice_date, 'dd/MM/yyyy')}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[invoice.payment_status] ?? 'outline'} className="capitalize">
                  {invoice.payment_status}
                </Badge>
              </TableCell>
              <TableCell>{totalQuantity}</TableCell>
              <TableCell>{formatAmount(invoice.total_amount)}</TableCell>
              <TableCell className={invoice.balance_due > 0 ? 'text-destructive' : ''}>
                {formatAmount(invoice.balance_due)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export default InvoiceHistoryTable
