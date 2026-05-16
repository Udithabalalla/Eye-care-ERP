import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiReceiptLine } from '@remixicon/react'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice } from '@/types/supplier.types'
import SupplierInvoiceForm from '@/components/suppliers/SupplierInvoiceForm'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'
import { formatCurrency } from '@/utils/formatters'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Paid: 'default',
  Partial: 'secondary',
  Unpaid: 'outline',
  Pending: 'outline',
  Overdue: 'destructive',
}

const SupplierInvoices = () => {
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplier-invoices', search],
    queryFn: () => suppliersApi.getSupplierInvoices({ page: 1, page_size: 100 }),
  })

  const rows = [...(data?.data || [])]
    .sort((left, right) => {
      const leftValue = new Date(left.created_at || left.invoice_date || '').getTime()
      const rightValue = new Date(right.created_at || right.invoice_date || '').getTime()
      return rightValue - leftValue
    })
    .filter((invoice) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [invoice.id, invoice.invoice_number, invoice.supplier_id, invoice.status]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Supplier Invoices
          </h1>
          <p className="text-sm text-muted-foreground">Track supplier bills and due dates.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedInvoice(null); setIsFormOpen(true) }}
        >
          <RiAddLine className="size-4" />
          Add Invoice
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Invoice Records</CardTitle>
              <CardDescription>Manage all supplier invoices and payments.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="relative w-full sm:w-72">
            <RiReceiptLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{invoice.invoice_number}</span>
                      </TableCell>
                      <TableCell>{invoice.supplier_name || invoice.supplier_id}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[invoice.status] ?? 'outline'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="data-[state=open]:bg-muted"
                              aria-label="Open supplier invoice actions"
                            >
                              <RiMore2Line className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => { setSelectedInvoice(invoice); setIsFormOpen(true) }}
                            >
                              Edit Invoice
                            </DropdownMenuItem>
                            {invoice.status !== 'Paid' && (
                              <DropdownMenuItem
                                onClick={() => { setSelectedInvoice(invoice); setIsPaymentOpen(true) }}
                              >
                                Record Payment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isFormOpen && (
        <SupplierInvoiceForm
          invoice={selectedInvoice}
          onSuccess={() => { setSelectedInvoice(null); setIsFormOpen(false); refetch() }}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
      {isPaymentOpen && selectedInvoice && (
        <SupplierPaymentForm
          invoiceId={selectedInvoice.id}
          onSuccess={() => { setSelectedInvoice(null); setIsPaymentOpen(false); refetch() }}
          onCancel={() => setIsPaymentOpen(false)}
        />
      )}
    </div>
  )
}

export default SupplierInvoices
