import { Badge, Table } from '@/components/ui'
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

const getStatus = (status: string) => {
  if (status === 'paid') return { color: 'success' as const, label: 'Paid' }
  if (status === 'pending') return { color: 'warning' as const, label: 'Pending' }
  return { color: 'gray' as const, label: status.replace(/-/g, ' ') }
}

const InvoiceHistoryTable = ({ invoices }: InvoiceHistoryTableProps) => {
  if (!invoices.length) {
    return <p className="py-4 text-sm text-muted-foreground">No invoice history found.</p>
  }

  return (
    <Table aria-label="Invoice history" size="sm">
      <Table.Header bordered={false}>
        <Table.Head label="Invoice ID" />
        <Table.Head label="Product/s" />
        <Table.Head label="Date of Invoice" />
        <Table.Head label="Status" />
        <Table.Head label="Qty" />
        <Table.Head label="Total (LKR)" />
        <Table.Head label="Remaining (LKR)" />
      </Table.Header>
      <Table.Body items={invoices}>
        {(invoice) => {
          const status = getStatus(invoice.payment_status)
          const productNames = Array.from(new Set(invoice.items.map((item) => item.product_name))).join(', ')
          const totalQuantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0)

          return (
            <Table.Row id={invoice.invoice_id}>
              <Table.Cell>
                <span className="font-medium text-brand-secondary">{invoice.invoice_number}</span>
              </Table.Cell>
              <Table.Cell className="max-w-[220px] truncate">{productNames}</Table.Cell>
              <Table.Cell>{formatDate(invoice.invoice_date, 'dd/MM/yyyy')}</Table.Cell>
              <Table.Cell>
                <Badge type="color" color={status.color} size="sm">
                  {status.label}
                </Badge>
              </Table.Cell>
              <Table.Cell>{totalQuantity}</Table.Cell>
              <Table.Cell>{formatAmount(invoice.total_amount)}</Table.Cell>
              <Table.Cell className={invoice.balance_due > 0 ? 'text-error-600' : ''}>
                {formatAmount(invoice.balance_due)}
              </Table.Cell>
            </Table.Row>
          )
        }}
      </Table.Body>
    </Table>
  )
}

export default InvoiceHistoryTable
