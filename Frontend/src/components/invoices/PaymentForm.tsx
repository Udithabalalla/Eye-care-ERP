import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentsApi } from '@/api/payments.api'
import { Invoice } from '@/types/invoice.types'
import { PaymentMethod } from '@/types/common.types'
import { LedgerReferenceType } from '@/types/erp.types'
import { formatCurrency } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { RiMoneyDollarCircleLine } from '@remixicon/react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from 'react-hot-toast'

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.nativeEnum(PaymentMethod),
  payment_date: z.string(),
  transaction_id: z.string().optional(),
  notes: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface PaymentFormProps {
  invoice: Invoice
  onSuccess: () => void
  onCancel: () => void
}

const PaymentForm = ({ invoice, onSuccess, onCancel }: PaymentFormProps) => {
  const queryClient = useQueryClient()

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: invoice.balance_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: PaymentMethod.CASH,
    },
  })

  const amount = form.watch('amount')

  const mutation = useMutation({
    mutationFn: (data: PaymentFormValues) =>
      paymentsApi.create({
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: new Date(data.payment_date).toISOString(),
        reference_type: 'INVOICE' as LedgerReferenceType,
        reference_id: invoice.invoice_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment recorded successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const onSubmit = (data: PaymentFormValues) => {
    if (data.amount > invoice.balance_due) {
      toast.error('Payment amount cannot exceed balance due')
      return
    }
    mutation.mutate(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Invoice summary */}
        <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice Number</span>
            <span className="font-medium">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium">{invoice.patient_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Paid</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(invoice.paid_amount)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Balance Due</span>
            <span className="text-destructive">{formatCurrency(invoice.balance_due)}</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Amount <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <div className="relative">
                  <RiMoneyDollarCircleLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    max={invoice.balance_due}
                    className="pl-9"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </div>
              </FormControl>
              {amount > invoice.balance_due && (
                <p className="text-sm text-destructive">Amount cannot exceed balance due</p>
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
              <FormLabel>Payment Method <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="netbanking">Net Banking</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
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
              <FormLabel>Payment Date <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transaction_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction ID / Reference</FormLabel>
              <FormControl>
                <Input placeholder="Optional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Optional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* After-payment preview */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">After this payment</p>
          <div className="flex justify-between text-muted-foreground">
            <span>Total Paid</span>
            <span className="font-semibold text-foreground">
              {formatCurrency((invoice.paid_amount || 0) + (amount || 0))}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Remaining Balance</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(invoice.balance_due - (amount || 0))}
            </span>
          </div>
          <div className="flex justify-between font-bold text-foreground">
            <span>Status</span>
            <span>{invoice.balance_due - (amount || 0) === 0 ? 'PAID ✓' : 'PARTIAL'}</span>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || amount > invoice.balance_due}>
            {mutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default PaymentForm
