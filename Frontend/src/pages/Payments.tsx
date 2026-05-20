import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiMoneyDollarCircleLine } from '@remixicon/react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Loading from '@/components/common/Loading'
import { paymentsApi } from '@/api/payments.api'
import { invoicesApi } from '@/api/invoices.api'
import { PaymentMethod } from '@/types/common.types'
import { LedgerReferenceType, Payment } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

const Payments = () => {
  const queryClient = useQueryClient()
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    reference_id: '',
    amount: '',
    payment_method: PaymentMethod.CASH,
    payment_date: new Date().toISOString().split('T')[0],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['payments', referenceType],
    queryFn: () =>
      paymentsApi.getAll({ page: 1, page_size: 100, reference_type: referenceType || undefined }),
  })

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['payments-invoice-lookup'],
    queryFn: () => invoicesApi.getAll({ page: 1, page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(form.amount)
      if (!form.reference_id) throw new Error('Invoice is required')
      if (!numericAmount || numericAmount <= 0) throw new Error('Payment amount must be greater than 0')
      return paymentsApi.create({
        amount: numericAmount,
        payment_method: form.payment_method,
        payment_date: new Date(form.payment_date).toISOString(),
        reference_type: 'INVOICE',
        reference_id: form.reference_id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Payment recorded successfully')
      setIsModalOpen(false)
      setForm({
        reference_id: '',
        amount: '',
        payment_method: PaymentMethod.CASH,
        payment_date: new Date().toISOString().split('T')[0],
      })
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to record payment')
    },
  })

  const selectedInvoice = useMemo(
    () => (invoicesData?.data || []).find((invoice) => invoice.invoice_id === form.reference_id),
    [invoicesData, form.reference_id],
  )

  const rows = (data?.data || []).filter((payment) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [payment.payment_id, payment.reference_id, payment.created_by]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Unified customer and supplier payments.</p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={() => setIsModalOpen(true)}>
          <RiAddLine className="size-4" />
          Record Payment
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Payment Records</CardTitle>
              <CardDescription>Track all incoming and outgoing payments.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {rows.length} total
            </Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <RiMoneyDollarCircleLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search payments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={referenceType || 'all'}
              onValueChange={(val) =>
                setReferenceType(val === 'all' ? '' : (val as LedgerReferenceType))
              }
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter by reference type">
                <SelectValue placeholder="Reference Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                <SelectItem value="INVOICE">Invoice</SelectItem>
                <SelectItem value="SALES_ORDER">Sales Order</SelectItem>
                <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem value="SUPPLIER_INVOICE">Supplier Invoice</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((payment: Payment) => (
                    <TableRow key={payment.payment_id}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground text-sm">
                          {payment.payment_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {payment.reference_type} / {payment.reference_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(payment.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {payment.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>{payment.transaction_id || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) setIsModalOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Invoice *</label>
              <Select
                value={form.reference_id || 'none'}
                onValueChange={(invoiceId) => {
                  if (invoiceId === 'none') return
                  const invoice = (invoicesData?.data || []).find(
                    (item) => item.invoice_id === invoiceId,
                  )
                  setForm((current) => ({
                    ...current,
                    reference_id: invoiceId,
                    amount: invoice ? String(invoice.balance_due || '') : current.amount,
                  }))
                }}
                disabled={isInvoicesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {(invoicesData?.data || []).map((invoice) => (
                    <SelectItem key={invoice.invoice_id} value={invoice.invoice_id}>
                      {invoice.invoice_number} — {invoice.patient_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Amount *</label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((c) => ({ ...c, amount: event.target.value }))}
              />
              {selectedInvoice && (
                <p className="text-xs text-muted-foreground">
                  Balance due: {formatCurrency(selectedInvoice.balance_due)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Payment Method *</label>
              <Select
                value={form.payment_method}
                onValueChange={(val) => setForm((c) => ({ ...c, payment_method: val as PaymentMethod }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.CASH}>Cash</SelectItem>
                  <SelectItem value={PaymentMethod.CARD}>Card</SelectItem>
                  <SelectItem value={PaymentMethod.UPI}>UPI</SelectItem>
                  <SelectItem value={PaymentMethod.NETBANKING}>Net Banking</SelectItem>
                  <SelectItem value={PaymentMethod.INSURANCE}>Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Payment Date *</label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(event) => setForm((c) => ({ ...c, payment_date: event.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending && <span className="mr-2 animate-spin">⟳</span>}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Payments
