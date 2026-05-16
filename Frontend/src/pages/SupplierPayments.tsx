import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiAddLine, RiMoneyDollarCircleLine, RiMore2Line } from '@remixicon/react'
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
import { SupplierPayment } from '@/types/supplier.types'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'
import { formatCurrency } from '@/utils/formatters'

const SupplierPayments = () => {
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplier-payments', search],
    queryFn: () => suppliersApi.getSupplierPayments({ page: 1, page_size: 100 }),
  })

  const rows = (data?.data || []).filter((payment) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [payment.id, payment.invoice_id, payment.payment_method]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Supplier Payments
          </h1>
          <p className="text-sm text-muted-foreground">Record and review supplier payments.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedPayment(null); setIsFormOpen(true) }}
        >
          <RiAddLine className="size-4" />
          Record Payment
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Payment Records</CardTitle>
              <CardDescription>Track all supplier payment history.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="relative w-full sm:w-72">
            <RiMoneyDollarCircleLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search payments..."
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
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{payment.id}</span>
                      </TableCell>
                      <TableCell>{payment.invoice_number || payment.invoice_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {payment.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(payment.amount_paid)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="data-[state=open]:bg-muted"
                              aria-label="Open payment actions"
                            >
                              <RiMore2Line className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => { setSelectedPayment(payment); setIsFormOpen(true) }}
                            >
                              View Details
                            </DropdownMenuItem>
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
        <SupplierPaymentForm
          payment={selectedPayment}
          onSuccess={() => { setSelectedPayment(null); setIsFormOpen(false); refetch() }}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
    </div>
  )
}

export default SupplierPayments
