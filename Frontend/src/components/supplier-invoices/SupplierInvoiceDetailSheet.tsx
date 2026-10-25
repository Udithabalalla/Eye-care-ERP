import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  RiAlertLine,
  RiBankCardLine,
  RiBox3Line,
  RiCalendarLine,
  RiFileTextLine,
  RiLoader4Line,
  RiMoneyDollarCircleLine,
  RiShoppingCartLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/api/suppliers.api'
import { usersApi } from '@/api/users.api'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { DrawerLoadingBar, DrawerRow, DrawerSection, LineItemList, MoneyStrip, type DrawerLineItem } from '@/components/common/DetailDrawer'
import { RecordSupplierPaymentDialog } from '@/components/purchase-orders/RecordSupplierPaymentDialog'
import { SupplierInvoiceStatusBadge } from './SupplierInvoiceStatusBadge'
import { daysOverdue, dueText } from '@/utils/supplierInvoice'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  'bank-transfer': 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  upi: 'UPI',
}

interface Props {
  invoiceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** A supplier's bill: what it covers, how it matched the order, and paying it */
export function SupplierInvoiceDetailSheet({ invoiceId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [payOpen, setPayOpen] = useState(false)
  const [dueDateOpen, setDueDateOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Switching to another invoice keeps the drawer open and starts at the top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [invoiceId])

  const { data: invoice, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['supplier-invoice', invoiceId],
    queryFn: () => suppliersApi.getSupplierInvoice(invoiceId!),
    enabled: open && !!invoiceId,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetching && isPlaceholderData

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['supplier-payments', 'by-invoice', invoice?.id],
    queryFn: () => suppliersApi.getSupplierPayments({ page: 1, page_size: 100, invoice_id: invoice!.id }),
    enabled: open && !!invoice,
    staleTime: 0,
  })
  const payments = paymentsData?.data ?? []

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const users: Array<{ user_id: string; name: string }> = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
  const nameOf = (userId?: string) => (userId ? users.find((u) => u.user_id === userId)?.name ?? userId : undefined)

  const paid = invoice?.paid_amount ?? 0
  const balance = invoice?.balance_due ?? Math.max((invoice?.total_amount ?? 0) - paid, 0)
  const overdueDays = invoice ? daysOverdue(invoice) : 0

  const lineItems: DrawerLineItem[] = (invoice?.items ?? []).map((item, index) => {
    const short = item.invoice_quantity < item.ordered_quantity
    const over = item.invoice_quantity > item.received_quantity
    return {
      key: `${item.product_id}-${index}`,
      name: item.product_name || item.product_id,
      detail: invoice?.purchase_order_id ? `Ordered ${item.ordered_quantity} · received ${item.received_quantity}` : undefined,
      qty: item.invoice_quantity,
      unitPrice: item.unit_price,
      total: item.line_total,
      note: over ? 'Billed for more than was received' : short ? 'Billed for fewer than ordered' : undefined,
      noteTone: 'warning',
    }
  })

  const goTo = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
          {/* ── Header ── */}
          <SheetHeader className="flex-shrink-0 space-y-1 border-b px-5 pb-4 pt-5">
            <SheetTitle className="pr-20 text-base font-semibold text-foreground">{invoice?.invoice_number ?? '…'}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {invoice && <SupplierInvoiceStatusBadge invoice={invoice} />}
                {invoice && <span className="font-medium text-foreground">{invoice.supplier_name || invoice.supplier_id}</span>}
                {invoice && <span>· {formatDate(invoice.invoice_date)}</span>}
              </div>
            </SheetDescription>
          </SheetHeader>
          <DrawerLoadingBar active={isSwitching} />

          {/* ── Body ── */}
          <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
            {!invoice ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <RiLoader4Line className="size-4 animate-spin" />
                Loading invoice…
              </div>
            ) : (
              <>
                <div className="space-y-3 border-b px-5 py-4">
                  <MoneyStrip
                    total={invoice.total_amount}
                    paid={paid}
                    balance={balance}
                    onRecordPayment={balance > 0 ? () => setPayOpen(true) : undefined}
                    actionLabel="Pay supplier"
                    note={
                      <span className={cn(overdueDays > 0 && 'font-medium text-destructive')}>
                        {dueText(invoice) ?? 'No due date set'}
                        {invoice.due_date && invoice.status !== 'Paid' ? ` · ${formatDate(invoice.due_date, 'dd MMM yyyy')}` : ''}
                      </span>
                    }
                  />
                  {(invoice.overpaid_amount ?? 0) > 0 && (
                    <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                      Advances came to {formatCurrency(invoice.overpaid_amount ?? 0)} more than this bill — the supplier owes you that, or it carries to your next order.
                    </p>
                  )}
                  {invoice.matching_status === 'Flagged' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <RiAlertLine className="size-3.5" />
                        Doesn’t match the purchase order
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {(invoice.matching_issues ?? []).slice(0, 5).map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                      <p className="mt-1.5 text-amber-800/80 dark:text-amber-300/80">Check with the supplier before paying.</p>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-border">
                  {lineItems.length > 0 && (
                    <DrawerSection icon={RiBox3Line} title={`Billed items (${lineItems.length})`}>
                      <LineItemList items={lineItems} />
                      <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                        <span>Invoice total</span>
                        <span className="tabular-nums">{formatCurrency(invoice.total_amount)}</span>
                      </div>
                    </DrawerSection>
                  )}

                  <DrawerSection
                    icon={RiFileTextLine}
                    title="Details"
                    action={
                      invoice.status !== 'Paid' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDueDateOpen(true)}>
                          Change due date
                        </Button>
                      )
                    }
                  >
                    <DrawerRow label="Supplier’s invoice no." value={invoice.invoice_number} />
                    <DrawerRow label="Invoice date" value={formatDate(invoice.invoice_date)} />
                    <DrawerRow label="Due" value={invoice.due_date ? formatDate(invoice.due_date) : 'Not set'} />
                    <DrawerRow
                      label="Purchase order"
                      value={
                        invoice.purchase_order_id ? (
                          <button type="button" className="font-medium text-primary hover:underline" onClick={() => goTo(`/purchase-orders?detail=${invoice.purchase_order_id}`)}>
                            {invoice.purchase_order_id}
                          </button>
                        ) : (
                          'Not linked'
                        )
                      }
                    />
                    {invoice.created_by && <DrawerRow label="Recorded by" value={nameOf(invoice.created_by)} />}
                  </DrawerSection>

                  <DrawerSection icon={RiBankCardLine} title={`Payments${payments.length ? ` (${payments.length})` : ''}`}>
                    {loadingPayments ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <RiLoader4Line className="size-3.5 animate-spin" />
                        Loading…
                      </div>
                    ) : payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
                    ) : (
                      <ul className="divide-y divide-border/70">
                        {payments.map((payment) => (
                          <li key={payment.id} className="flex items-start justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-sm font-medium">
                                {formatDate(payment.payment_date)}
                                {payment.is_advance && (
                                  <span className="rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">Paid ahead</span>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[METHOD_LABELS[payment.payment_method] ?? payment.payment_method, payment.reference_number].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount_paid)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DrawerSection>
                </div>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          {invoice && (
            <div className="flex flex-shrink-0 flex-col gap-2 border-t bg-background px-5 py-3">
              {balance > 0 && (
                <Button className="w-full gap-2 font-semibold" onClick={() => setPayOpen(true)}>
                  <RiMoneyDollarCircleLine className="size-4" />
                  Pay supplier · {formatCurrency(balance)}
                </Button>
              )}
              {invoice.purchase_order_id && (
                <Button variant="outline" className="w-full gap-1.5" onClick={() => goTo(`/purchase-orders?detail=${invoice.purchase_order_id}`)}>
                  <RiShoppingCartLine className="size-4" />
                  Open purchase order {invoice.purchase_order_id}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RecordSupplierPaymentDialog open={payOpen} onClose={() => setPayOpen(false)} supplierInvoice={invoice ?? null} />
      {invoice && <DueDateDialog open={dueDateOpen} onClose={() => setDueDateOpen(false)} invoiceId={invoice.id} current={invoice.due_date} />}
    </>
  )
}

const dueSchema = z.object({ due_date: z.string().min(1, 'Pick a date') })

function DueDateDialog({ open, onClose, invoiceId, current }: { open: boolean; onClose: () => void; invoiceId: string; current?: string }) {
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof dueSchema>>({
    resolver: zodResolver(dueSchema),
    values: { due_date: current ? current.slice(0, 10) : '' },
  })
  const mutation = useMutation({
    mutationFn: (dueDate: string) => suppliersApi.updateSupplierInvoice(invoiceId, { due_date: new Date(dueDate).toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
      toast.success('Due date updated')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Could not change the due date'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiCalendarLine className="size-4" />
            Change due date
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v.due_date))} className="space-y-4">
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay by</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
