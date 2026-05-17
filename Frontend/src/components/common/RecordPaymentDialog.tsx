import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  RiMoneyDollarCircleLine,
  RiLoader4Line,
  RiCheckLine,
} from '@remixicon/react'
import { paymentsApi } from '@/api/payments.api'
import { PaymentMethod } from '@/types/common.types'
import { LedgerReferenceType } from '@/types/erp.types'
import { formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

const schema = z.object({
  amount: z.number({ invalid_type_error: 'Enter a valid amount' }).min(0.01, 'Amount must be greater than 0'),
  payment_method: z.nativeEnum(PaymentMethod),
  payment_date: z.string().min(1, 'Date is required'),
  transaction_id: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: PaymentMethod.CASH, label: 'Cash' },
  { value: PaymentMethod.CARD, label: 'Card' },
  { value: PaymentMethod.UPI, label: 'UPI' },
  { value: PaymentMethod.NETBANKING, label: 'Net Banking' },
  { value: PaymentMethod.INSURANCE, label: 'Insurance' },
]

export interface RecordPaymentDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  title?: string
  description?: string
  /** Reference for the payment */
  referenceType: LedgerReferenceType
  referenceId: string
  /** Display context */
  totalAmount: number
  paidAmount?: number
  patientName?: string
  invoiceNumber?: string
  /** Invalidate these query keys on success */
  invalidateKeys?: unknown[][]
}

export function RecordPaymentDialog({
  open,
  onClose,
  onSuccess,
  title = 'Record Payment',
  description,
  referenceType,
  referenceId,
  totalAmount,
  paidAmount = 0,
  patientName,
  invoiceNumber,
  invalidateKeys = [],
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient()
  const balanceDue = Math.max(totalAmount - paidAmount, 0)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: balanceDue,
      payment_method: PaymentMethod.CASH,
      payment_date: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        amount: balanceDue,
        payment_method: PaymentMethod.CASH,
        payment_date: new Date().toISOString().split('T')[0],
      })
    }
  }, [open, balanceDue, reset])

  const amount = watch('amount') || 0

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      paymentsApi.create({
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        reference_type: referenceType,
        reference_id: referenceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      toast.success('Payment recorded')
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to record payment')
    },
  })

  const remainingAfter = balanceDue - amount
  const willBeFullyPaid = remainingAfter <= 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiMoneyDollarCircleLine className="h-5 w-5 text-emerald-500" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
            {patientName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">{patientName}</span>
              </div>
            )}
            {invoiceNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-medium font-mono text-xs">{invoiceNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-medium tabular-nums">{formatCurrency(totalAmount)}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(paidAmount)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span className="tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(balanceDue)}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Payment Amount</label>
            <div className="relative">
              <RiMoneyDollarCircleLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min={0.01}
                max={balanceDue}
                className="pl-9 h-10 tabular-nums"
                {...register('amount', { valueAsNumber: true })}
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            {amount > balanceDue && (
              <p className="text-xs text-destructive">Amount exceeds balance due</p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Payment Method</label>
            <Select
              defaultValue={PaymentMethod.CASH}
              onValueChange={(v) => setValue('payment_method', v as PaymentMethod)}
            >
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Payment Date</label>
            <Input type="date" className="h-10" {...register('payment_date')} />
            {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Reference / Transaction ID <span className="font-normal">(optional)</span></label>
            <Input placeholder="Bank ref, cheque no, etc." className="h-10" {...register('transaction_id')} />
          </div>

          {/* After-payment preview */}
          {amount > 0 && amount <= balanceDue && (
            <div className={`rounded-lg border p-3 text-sm ${willBeFullyPaid ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'}`}>
              <p className={`font-semibold mb-1.5 ${willBeFullyPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}`}>
                After this payment:
              </p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(Math.max(remainingAfter, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-bold flex items-center gap-1 ${willBeFullyPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {willBeFullyPaid ? <><RiCheckLine className="h-3.5 w-3.5" /> Fully Paid</> : 'Partial Payment'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || amount <= 0 || amount > balanceDue}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            >
              {mutation.isPending ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiMoneyDollarCircleLine className="h-4 w-4" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
