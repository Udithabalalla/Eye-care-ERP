import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import Loading from '@/components/common/Loading'
import { paymentsApi } from '@/api/payments.api'
import { invoicesApi } from '@/api/invoices.api'
import { PaymentMethod } from '@/types/common.types'
import { LedgerReferenceType, Payment } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { toast } from 'sonner'

const today = () => new Date().toISOString().split('T')[0]

const paymentSchema = z.object({
  reference_id: z.string().min(1, 'Choose the invoice being paid'),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Payment amount must be greater than 0'),
  payment_method: z.nativeEnum(PaymentMethod),
  payment_date: z.string().min(1, 'Choose the payment date'),
})
type PaymentFormValues = z.infer<typeof paymentSchema>

const emptyPayment = (): PaymentFormValues => ({
  reference_id: '',
  amount: '' as unknown as number,
  payment_method: PaymentMethod.CASH,
  payment_date: today(),
})

const Payments = () => {
  const queryClient = useQueryClient()
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: emptyPayment(),
  })
  const referenceId = form.watch('reference_id')

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
    mutationFn: (values: PaymentFormValues) =>
      paymentsApi.create({
        amount: values.amount,
        payment_method: values.payment_method,
        payment_date: new Date(values.payment_date).toISOString(),
        reference_type: 'INVOICE',
        reference_id: values.reference_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Payment recorded successfully')
      setIsModalOpen(false)
      form.reset(emptyPayment())
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to record payment')
    },
  })

  const selectedInvoice = useMemo(
    () => (invoicesData?.data || []).find((invoice) => invoice.invoice_id === referenceId),
    [invoicesData, referenceId],
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="reference_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice *</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(invoiceId) => {
                        field.onChange(invoiceId)
                        // Start from what is still owed on that invoice
                        const invoice = (invoicesData?.data || []).find((item) => item.invoice_id === invoiceId)
                        if (invoice?.balance_due) form.setValue('amount', invoice.balance_due, { shouldValidate: true })
                      }}
                      disabled={isInvoicesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(invoicesData?.data || []).map((invoice) => (
                          <SelectItem key={invoice.invoice_id} value={invoice.invoice_id}>
                            {invoice.invoice_number} — {invoice.patient_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0.01} step="0.01" {...field} />
                    </FormControl>
                    {selectedInvoice && (
                      <FormDescription>Balance due: {formatCurrency(selectedInvoice.balance_due)}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PaymentMethod.CASH}>Cash</SelectItem>
                        <SelectItem value={PaymentMethod.CARD}>Card</SelectItem>
                        <SelectItem value={PaymentMethod.UPI}>UPI</SelectItem>
                        <SelectItem value={PaymentMethod.NETBANKING}>Net Banking</SelectItem>
                        <SelectItem value={PaymentMethod.INSURANCE}>Insurance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Spinner />}
                  Record Payment
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Payments
