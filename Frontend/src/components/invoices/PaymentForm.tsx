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
import { RiMoneyDollarCircleLine } from '@remixicon/react'
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

const inputClass = 'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'

const PaymentForm = ({ invoice, onSuccess, onCancel }: PaymentFormProps) => {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: invoice.balance_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: PaymentMethod.CASH,
    },
  })

  const amount = watch('amount')

  const mutation = useMutation({
    mutationFn: (data: PaymentFormValues) =>
      paymentsApi.create({
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        reference_type: 'INVOICE' as LedgerReferenceType,
        reference_id: invoice.invoice_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment recorded successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to record payment')
    },
  })

  const onSubmit = (data: PaymentFormValues) => {
    if (data.amount > invoice.balance_due) {
      toast.error('Payment amount cannot exceed balance due')
      return
    }
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-secondary p-4 rounded-lg space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Invoice Number:</span>
          <span className="font-medium">{invoice.invoice_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Patient:</span>
          <span className="font-medium">{invoice.patient_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Amount:</span>
          <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Already Paid:</span>
          <span className="font-medium text-success-600">
            {formatCurrency(invoice.paid_amount)}
          </span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Balance Due:</span>
          <span className="text-error-600">{formatCurrency(invoice.balance_due)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Payment Amount *
        </label>
        <div className="relative">
          <RiMoneyDollarCircleLine className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="pl-10"
            max={invoice.balance_due}
          />
        </div>
        {errors.amount && (
          <p className="text-sm text-error-600 mt-1">{errors.amount.message}</p>
        )}
        {amount > invoice.balance_due && (
          <p className="text-sm text-error-600 mt-1">
            Amount cannot exceed balance due
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Payment Method *
        </label>
        <select {...register('payment_method')} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="netbanking">Net Banking</option>
          <option value="insurance">Insurance</option>
        </select>
        {errors.payment_method && (
          <p className="text-sm text-error-600 mt-1">{errors.payment_method.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Payment Date *
        </label>
        <Input type="date" {...register('payment_date')} />
        {errors.payment_date && (
          <p className="text-sm text-error-600 mt-1">{errors.payment_date.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Transaction ID / Reference Number
        </label>
        <Input {...register('transaction_id')} placeholder="Optional" />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Notes</label>
        <textarea {...register('notes')} rows={2} className={inputClass} placeholder="Optional" />
      </div>

      <div className="bg-brand-50 dark:bg-brand-950 p-4 rounded-lg border border-brand-200 dark:border-brand-800">
        <p className="text-sm text-brand-900 dark:text-brand-100 font-medium mb-2">After this payment:</p>
        <div className="space-y-1 text-sm text-brand-800 dark:text-brand-200">
          <div className="flex justify-between">
            <span>Total Paid:</span>
            <span className="font-semibold">
              {formatCurrency((invoice.paid_amount || 0) + (amount || 0))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Remaining Balance:</span>
            <span className="font-semibold">
              {formatCurrency(invoice.balance_due - (amount || 0))}
            </span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Status:</span>
            <span>
              {invoice.balance_due - (amount || 0) === 0
                ? 'PAID ✓'
                : 'PARTIAL'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || amount > invoice.balance_due}
        >
          {isSubmitting ? 'Recording...' : 'Record Payment'}
        </Button>
      </div>
    </form>
  )
}

export default PaymentForm
