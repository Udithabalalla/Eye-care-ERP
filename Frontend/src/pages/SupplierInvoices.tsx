import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiAddLine, RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice } from '@/types/supplier.types'
import SupplierInvoiceForm from '@/components/suppliers/SupplierInvoiceForm'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'

const SupplierInvoices = () => {
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplier-invoices', search],
    queryFn: () => suppliersApi.getSupplierInvoices({ page: 1, page_size: 100 }),
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Supplier Invoices</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Track supplier bills and due dates</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => { setSelectedInvoice(null); setIsFormOpen(true) }}>
              <RiAddLine className="size-4 mr-1" />
              Add Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
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
                {(data?.data || []).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.supplier_id}</TableCell>
                    <TableCell>{invoice.status}</TableCell>
                    <TableCell>{invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(invoice); setIsFormOpen(true) }}>Edit</Button>
                        {invoice.status !== 'Paid' && (
                          <Button size="sm" onClick={() => { setSelectedInvoice(invoice); setIsPaymentOpen(true) }}>Record Payment</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {isFormOpen && <SupplierInvoiceForm invoice={selectedInvoice} onSuccess={() => { setSelectedInvoice(null); setIsFormOpen(false); refetch() }} onCancel={() => setIsFormOpen(false)} />}
      {isPaymentOpen && selectedInvoice && <SupplierPaymentForm invoiceId={selectedInvoice.id} onSuccess={() => { setSelectedInvoice(null); setIsPaymentOpen(false); refetch() }} onCancel={() => setIsPaymentOpen(false)} />}
    </div>
  )
}

export default SupplierInvoices
