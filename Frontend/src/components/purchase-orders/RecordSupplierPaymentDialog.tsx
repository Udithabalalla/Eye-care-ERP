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
  RiTruckLine,
} from '@remixicon/react'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice } from '@/types/supplier.types'
import { formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

const schema = z.object({
  amount_paid: z.number({ invalid_type_error: 'Enter a valid amount' }).min(0.01, 'Amount must be greater than 0'),
  payment_method: z.string().min(1, 'Select a payment method'),
  payment_date: z.string().min(1, 'Date is required'),
  reference_number: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank-transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  supplierInvoice: SupplierInvoice | null
  /** Amount already paid against this invoice (if known) */
  paidAmount?: number
}

export function RecordSupplierPaymentDialog({ open, onClose, onSuccess, supplierInvoice, paidAmount = 0 }: Props) {
  const queryClient = useQueryClient()
  if (!supplierInvoice) return null

  const balanceDue = Math.max((supplierInvoice.total_amount ?? 0) - paidAmount, 0)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount_paid: balanceDue,
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        amount_paid: balanceDue,
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
      })
    }
  }, [open, balanceDue, reset])

  const amountPaid = watch('amount_paid') || 0

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      suppliersApi.recordSupplierInvoicePayment(supplierInvoice.id, {
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        reference_number: data.reference_number,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Supplier payment recorded')
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to record payment')
    },
  })

  const remainingAfter = balanceDue - amountPaid
  const willBeFullyPaid = remainingAfter <= 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiTruckLine className="h-5 w-5 text-violet-500" />
            Record Supplier Payment
          </DialogTitle>
          <DialogDescription>
            Record payment against supplier invoice {supplierInvoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
            {supplierInvoice.supplier_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium">{supplierInvoice.supplier_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice No.</span>
              <span className="font-medium font-mono text-xs">{supplierInvoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="font-medium tabular-nums">{formatCurrency(supplierInvoice.total_amount)}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(paidAmount)}</span>
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
                {...register('amount_paid', { valueAsNumber: true })}
              />
            </div>
            {errors.amount_paid && <p className="text-xs text-destructive">{errors.amount_paid.message}</p>}
            {amountPaid > balanceDue && <p className="text-xs text-destructive">Amount exceeds balance due</p>}
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Payment Method</label>
            <Select defaultValue="cash" onValueChange={(v) => setValue('payment_method', v)}>
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
            <label className="text-sm font-medium text-muted-foreground">Reference / Cheque No. <span className="font-normal">(optional)</span></label>
            <Input placeholder="Bank ref, cheque no, etc." className="h-10" {...register('reference_number')} />
          </div>

          {/* Preview */}
          {amountPaid > 0 && amountPaid <= balanceDue && (
            <div className={`rounded-lg border p-3 text-sm ${willBeFullyPaid ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800'}`}>
              <p className={`font-semibold mb-1.5 ${willBeFullyPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300'}`}>
                After this payment:
              </p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(Math.max(remainingAfter, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-bold flex items-center gap-1 ${willBeFullyPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`}>
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
              disabled={mutation.isPending || amountPaid <= 0 || amountPaid > balanceDue}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white border-violet-600"
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
