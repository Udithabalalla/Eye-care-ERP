import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { RiCheckLine, RiLoader4Line, RiMoneyDollarCircleLine } from '@remixicon/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SearchableLOV from '@/components/common/SearchableLOV'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice } from '@/types/supplier.types'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'

/** What the dialog needs to know about the bill being paid */
export type PayableSupplierInvoice = Pick<SupplierInvoice, 'id' | 'invoice_number' | 'total_amount'> &
  Partial<Pick<SupplierInvoice, 'supplier_name' | 'paid_amount' | 'purchase_order_id' | 'due_date'>>

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
]

const schema = z.object({
  amount_paid: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Enter an amount above zero'),
  payment_method: z.string().min(1, 'Choose how it was paid'),
  payment_date: z.string().min(1, 'Pick the payment date'),
  reference_number: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const today = () => format(new Date(), 'yyyy-MM-dd')

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  /** The bill to pay; leave it out to pick one of the unpaid bills */
  supplierInvoice?: PayableSupplierInvoice | null
  /** Already paid — defaults to what the invoice says */
  paidAmount?: number
  /** Pay ahead on an order that has no invoice yet (instead of paying a bill) */
  advanceFor?: AdvanceTarget | null
}

export interface AdvanceTarget {
  orderId: string
  orderTotal: number
  /** Already paid ahead on the order */
  advancePaid: number
  supplierName?: string
}

export function RecordSupplierPaymentDialog({ open, onClose, onSuccess, supplierInvoice, paidAmount, advanceFor }: Props) {
  const queryClient = useQueryClient()
  const [pickedId, setPickedId] = useState('')

  // Picking a bill: only the ones still owing
  const { data: unpaidData } = useQuery({
    queryKey: ['supplier-invoices', 'unpaid-for-payment'],
    queryFn: async () => {
      const [unpaid, partial] = await Promise.all([
        suppliersApi.getSupplierInvoices({ page: 1, page_size: 100, status: 'Unpaid' }),
        suppliersApi.getSupplierInvoices({ page: 1, page_size: 100, status: 'Partial' }),
      ])
      return [...unpaid.data, ...partial.data].filter((inv) => (inv.balance_due ?? inv.total_amount) > 0)
    },
    enabled: open && !supplierInvoice && !advanceFor,
    staleTime: 0,
  })
  const unpaid = unpaidData ?? []
  const invoice: PayableSupplierInvoice | null = supplierInvoice ?? unpaid.find((inv) => inv.id === pickedId) ?? null

  // What's being paid: a bill, or the order itself ahead of its bill
  const target = advanceFor
    ? { total: advanceFor.orderTotal, paid: advanceFor.advancePaid }
    : invoice
      ? { total: invoice.total_amount, paid: paidAmount ?? invoice.paid_amount ?? 0 }
      : null
  const alreadyPaid = target?.paid ?? 0
  const balanceDue = target ? Math.max(target.total - alreadyPaid, 0) : 0

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount_paid: balanceDue, payment_method: 'cash', payment_date: today(), reference_number: '' },
  })

  useEffect(() => {
    if (!open) return
    setPickedId('')
    form.reset({ amount_paid: balanceDue, payment_method: 'cash', payment_date: today(), reference_number: '' })
    // Reset only when the dialog opens or the bill changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierInvoice?.id, advanceFor?.orderId])

  // A newly picked bill starts at its full balance
  useEffect(() => {
    if (pickedId) form.setValue('amount_paid', balanceDue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedId])

  const amount = Number(useWatch({ control: form.control, name: 'amount_paid' })) || 0
  const remainingAfter = balanceDue - amount
  const overpaying = amount > balanceDue + 0.005

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        payment_date: new Date(data.payment_date).toISOString(),
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        reference_number: data.reference_number || undefined,
      }
      return advanceFor
        ? suppliersApi.recordAdvancePayment(advanceFor.orderId, payload)
        : suppliersApi.recordSupplierInvoicePayment(invoice!.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-invoice'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
      toast.success(
        advanceFor
          ? `Advance recorded on ${advanceFor.orderId}`
          : remainingAfter <= 0.005 ? `${invoice?.invoice_number} paid in full` : 'Supplier payment recorded',
      )
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to record payment')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{advanceFor ? 'Pay in advance' : 'Pay supplier'}</DialogTitle>
          <DialogDescription>
            {advanceFor
              ? `On ${advanceFor.orderId}${advanceFor.supplierName ? ` to ${advanceFor.supplierName}` : ''} — it counts against their invoice once that’s recorded.`
              : invoice
                ? `Against invoice ${invoice.invoice_number}${invoice.supplier_name ? ` from ${invoice.supplier_name}` : ''}`
                : 'Choose the bill this payment is for'}
          </DialogDescription>
        </DialogHeader>

        {!supplierInvoice && !advanceFor && (
          <SearchableLOV
            label="Supplier invoice"
            required
            placeholder={unpaidData ? (unpaid.length ? 'Search unpaid bills…' : 'Nothing is waiting to be paid') : 'Loading bills…'}
            value={pickedId}
            onChange={setPickedId}
            options={unpaid.map((inv) => ({
              value: inv.id,
              label: `${inv.invoice_number} · ${inv.supplier_name ?? inv.supplier_id}`,
              subtitle: `${formatCurrency(inv.balance_due ?? inv.total_amount)} to pay${inv.due_date ? ` · due ${formatDate(inv.due_date, 'dd MMM')}` : ''}`,
            }))}
          />
        )}

        {target && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              {/* Where the bill stands */}
              <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border text-sm">
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{advanceFor ? 'Order total' : 'Invoice total'}</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(target.total)}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{advanceFor ? 'Paid ahead' : 'Paid so far'}</p>
                  <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(alreadyPaid)}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{advanceFor ? 'Up to' : 'To pay'}</p>
                  <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(balanceDue)}</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount_paid"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Amount</FormLabel>
                      <div className="flex gap-1">
                        {[['Full', balanceDue], ['Half', Math.round(balanceDue * 50) / 100]].map(([label, value]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => form.setValue('amount_paid', Number(value), { shouldValidate: true })}
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                              Math.abs(amount - Number(value)) < 0.005 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <FormControl>
                      <Input type="number" step="0.01" min={0.01} inputMode="decimal" className="tabular-nums" {...field} value={Number.isNaN(field.value) ? '' : field.value} />
                    </FormControl>
                    {overpaying && (
                      <p className="text-xs text-destructive">
                        {advanceFor ? `That’s more than the order — at most ${formatCurrency(balanceDue)}` : `That’s more than the ${formatCurrency(balanceDue)} still owed`}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid by</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
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
                      <FormLabel>Paid on</FormLabel>
                      <FormControl>
                        <Input type="date" max={today()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reference_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Bank ref or cheque number" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount > 0 && !overpaying && (
                <p className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm', remainingAfter <= 0.005 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-muted/50 text-muted-foreground')}>
                  {advanceFor ? (
                    remainingAfter <= 0.005 ? (
                      <>
                        <RiCheckLine className="size-4 shrink-0" />
                        Pays for the whole order up front
                      </>
                    ) : (
                      <>{formatCurrency(remainingAfter)} left to pay once the invoice comes in</>
                    )
                  ) : remainingAfter <= 0.005 ? (
                    <>
                      <RiCheckLine className="size-4 shrink-0" />
                      Pays the bill in full{invoice?.purchase_order_id ? ` and closes ${invoice.purchase_order_id}` : ''}
                    </>
                  ) : (
                    <>{formatCurrency(remainingAfter)} will still be owed</>
                  )}
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending || amount <= 0 || overpaying} className="gap-1.5">
                  {mutation.isPending ? <RiLoader4Line className="size-4 animate-spin" /> : <RiMoneyDollarCircleLine className="size-4" />}
                  {advanceFor ? 'Record advance' : 'Record payment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
