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
import { SupplierPayment } from '@/types/supplier.types'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'

const SupplierPayments = () => {
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplier-payments', search],
    queryFn: () => suppliersApi.getSupplierPayments({ page: 1, page_size: 100 }),
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Supplier Payments</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Record and review supplier payments</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search payments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => { setSelectedPayment(null); setIsFormOpen(true) }}>
              <RiAddLine className="size-4 mr-1" />
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data || []).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.id}</TableCell>
                    <TableCell>{payment.invoice_id}</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>{payment.amount_paid.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedPayment(payment); setIsFormOpen(true) }}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {isFormOpen && <SupplierPaymentForm payment={selectedPayment} onSuccess={() => { setSelectedPayment(null); setIsFormOpen(false); refetch() }} onCancel={() => setIsFormOpen(false)} />}
    </div>
  )
}

export default SupplierPayments
