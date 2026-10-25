import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import { RiArrowRightSLine, RiLoader4Line, RiShoppingCartLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import SearchableLOV from '@/components/common/SearchableLOV'
import { suppliersApi } from '@/api/suppliers.api'
import { extractApiErrorMessage } from '@/api/axios'
import { PurchaseOrder, SupplierInvoice } from '@/types/supplier.types'
import { formatCurrency, formatDate } from '@/utils/formatters'

const schema = z
  .object({
    invoice_number: z.string().trim().min(1, 'Enter the number on the supplier’s bill'),
    invoice_date: z.string().min(1, 'Pick the invoice date'),
    due_date: z.string().optional(),
    total_amount: z.coerce.number({ invalid_type_error: 'Enter the amount' }).positive('Enter the amount on the bill'),
  })
  .refine((v) => !v.due_date || v.due_date >= v.invoice_date, { path: ['due_date'], message: 'Due date can’t be before the invoice date' })
type FormValues = z.infer<typeof schema>

const today = () => format(new Date(), 'yyyy-MM-dd')

/** "30 days", "Net 45" → 30, 45 */
const termDays = (terms?: string) => {
  const match = terms?.match(/(\d{1,3})/)
  return match ? Number(match[1]) : undefined
}

interface Props {
  open: boolean
  onClose: () => void
  /** A received order was picked — record its invoice against it (with line matching) */
  onPickOrder: (order: PurchaseOrder) => void
  onCreated: (invoice: SupplierInvoice) => void
}

/**
 * Adding a supplier's bill. Most bills belong to an order that has arrived, so
 * those are offered first; anything else (services, one-off buys) is entered by hand.
 */
export function AddSupplierInvoiceDialog({ open, onClose, onPickOrder, onCreated }: Props) {
  const queryClient = useQueryClient()
  const [supplierId, setSupplierId] = useState('')

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const suppliers = useMemo(() => suppliersData?.data ?? [], [suppliersData])
  const supplier = suppliers.find((s) => s.id === supplierId)

  // Orders from this supplier that have arrived but have no invoice yet
  const { data: waitingOrders, isFetching: loadingOrders } = useQuery({
    queryKey: ['purchase-orders', 'awaiting-invoice', supplierId],
    queryFn: async () => {
      const [received, partial] = await Promise.all([
        suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, supplier_id: supplierId, status: 'Received' }),
        suppliersApi.getPurchaseOrders({ page: 1, page_size: 100, supplier_id: supplierId, status: 'Partially Received' }),
      ])
      return [...received.data, ...partial.data].filter((order) => !order.supplier_invoice)
    },
    enabled: open && !!supplierId,
    staleTime: 0,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { invoice_number: '', invoice_date: today(), due_date: '', total_amount: Number.NaN },
  })
  const invoiceDate = useWatch({ control: form.control, name: 'invoice_date' })

  useEffect(() => {
    if (!open) return
    setSupplierId('')
    form.reset({ invoice_number: '', invoice_date: today(), due_date: '', total_amount: Number.NaN })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The supplier's agreed terms set the due date ("30 days" → invoice date + 30)
  const days = termDays(supplier?.payment_terms)
  useEffect(() => {
    if (days && invoiceDate && !form.getFieldState('due_date').isDirty) {
      form.setValue('due_date', format(addDays(new Date(invoiceDate), days), 'yyyy-MM-dd'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, invoiceDate])

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.supplier_name, subtitle: s.payment_terms ? `Terms: ${s.payment_terms}` : undefined })),
    [suppliers],
  )

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      suppliersApi.createSupplierInvoice({
        supplier_id: supplierId,
        invoice_number: values.invoice_number.trim(),
        invoice_date: new Date(values.invoice_date).toISOString(),
        due_date: values.due_date ? new Date(values.due_date).toISOString() : undefined,
        total_amount: values.total_amount,
        status: 'Unpaid',
      }),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
      toast.success(`Invoice ${invoice.invoice_number} added`)
      onCreated(invoice)
    },
    onError: (error: any) => toast.error(extractApiErrorMessage(error?.response?.data?.detail, 'Could not add the invoice')),
  })

  const orders = waitingOrders ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add supplier invoice</DialogTitle>
          <DialogDescription>Record a bill you’ve received so it can be paid.</DialogDescription>
        </DialogHeader>

        <SearchableLOV label="Supplier" required placeholder="Search suppliers…" value={supplierId} onChange={setSupplierId} options={supplierOptions} />

        {supplierId && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Orders from {supplier?.supplier_name} waiting for their invoice</p>
            {loadingOrders ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Checking orders…
              </div>
            ) : orders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                None — enter the bill below.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {orders.map((order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => onPickOrder(order)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <RiShoppingCartLine className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{order.id}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {order.items[0]?.item_name ?? `${order.items.length} items`}
                            {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''} · {order.status === 'Received' ? 'received' : 'part received'} {formatDate(order.updated_at, 'dd MMM')}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums">
                        {formatCurrency(order.total_amount)}
                        <RiArrowRightSLine className="size-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {supplierId && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">{orders.length ? 'Or a bill without an order' : 'Bill details'}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice number</FormLabel>
                      <FormControl><Input placeholder="As printed on the bill" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" inputMode="decimal" className="tabular-nums" {...field} value={Number.isNaN(field.value) ? '' : field.value} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice date</FormLabel>
                      <FormControl><Input type="date" max={today()} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay by <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                      <FormControl><Input type="date" min={invoiceDate} {...field} value={field.value ?? ''} /></FormControl>
                      {days ? <FormDescription>{days} days, from {supplier?.supplier_name}’s terms</FormDescription> : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                  Add invoice
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
