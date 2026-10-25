import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiAlertLine, RiAttachment2, RiDownloadLine, RiLoader4Line, RiMailSendLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { suppliersApi } from '@/api/suppliers.api'
import { companyProfileApi } from '@/api/company-profile.api'
import { PurchaseOrder } from '@/types/supplier.types'
import { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { downloadFile } from '@/utils/helpers'

const schema = z.object({
  to: z.string().trim().email('Enter the supplier’s email address'),
  cc: z.string().trim().email('Not an email address').or(z.literal('')).optional(),
  subject: z.string().trim().min(1, 'Add a subject'),
  message: z.string().trim().min(1, 'Add a short message'),
  markOrdered: z.boolean(),
})
type FormValues = z.infer<typeof schema>

/** Same wording the server uses when no message is given */
const defaultMessage = (order: PurchaseOrder, company?: CompanyProfile) => {
  const supplier = order.supplier_information
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const lines = [
    `Dear ${supplier?.contact_person || supplier?.supplier_name || 'Sir/Madam'},`,
    '',
    `Please find attached our purchase order ${order.id} for ${units} unit${units === 1 ? '' : 's'}, totalling ${formatCurrency(order.total_amount)}.`,
  ]
  if (order.expected_delivery_date) lines.push(`We'd like it delivered by ${formatDate(order.expected_delivery_date, 'dd MMM yyyy')}.`)
  if (order.shipping_information?.delivery_address) lines.push(`Delivery address: ${order.shipping_information.delivery_address}`)
  lines.push('', 'Please confirm the order and the delivery date.', '', 'Thank you,', company?.company_name || 'Vision Opticals')
  if (company?.phone) lines.push(company.phone)
  return lines.join('\n')
}

interface Props {
  order: PurchaseOrder | null
  open: boolean
  onClose: () => void
  onDone?: (order: PurchaseOrder) => void
}

/**
 * Placing an order with the supplier: email the PO with its PDF attached, or —
 * when it went by phone or WhatsApp — download the PDF and just mark it ordered.
 */
export function SendPurchaseOrderDialog({ order, open, onClose, onDone }: Props) {
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const isApproved = order?.status === 'Approved'

  const { data: company } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { to: '', cc: '', subject: '', message: '', markOrdered: true },
  })

  useEffect(() => {
    if (!open || !order) return
    setSendError(null)
    form.reset({
      to: order.supplier_information?.email ?? '',
      cc: '',
      subject: `Purchase order ${order.id} from ${company?.company_name || 'Vision Opticals'}`,
      message: defaultMessage(order, company),
      markOrdered: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id, company?.company_name])

  const refresh = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
  }

  const sendMutation = useMutation({
    mutationFn: (values: FormValues) =>
      suppliersApi.sendPurchaseOrder(order!.id, {
        to: values.to,
        cc: values.cc || undefined,
        subject: values.subject,
        message: values.message,
        mark_ordered: isApproved && values.markOrdered,
      }),
    onSuccess: (updated, values) => {
      refresh(updated.id)
      toast.success(updated.status === 'Ordered' && isApproved ? `Sent to ${values.to} — ${updated.id} is now ordered` : `Sent to ${values.to}`)
      onDone?.(updated)
      onClose()
    },
    onError: (error: any) => setSendError(error?.response?.data?.detail || 'The email couldn’t be sent'),
  })

  const markMutation = useMutation({
    mutationFn: () => suppliersApi.updatePurchaseOrderStatus(order!.id, 'Ordered'),
    onSuccess: (updated) => {
      refresh(updated.id)
      toast.success(`${updated.id} marked as ordered`)
      onDone?.(updated)
      onClose()
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Could not mark it as ordered'),
  })

  const downloadPdf = async () => {
    if (!order) return
    setDownloading(true)
    try {
      downloadFile(await suppliersApi.downloadPurchaseOrderPdf(order.id), `${order.id}.pdf`)
    } catch {
      toast.error('Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const busy = sendMutation.isPending || markMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{order?.sent_at ? 'Send to supplier again' : 'Send to supplier'}</DialogTitle>
          <DialogDescription>
            {order?.supplier_information?.supplier_name ?? 'The supplier'} gets the purchase order by email with the PDF attached.
            {order?.sent_at ? ` Last sent to ${order.sent_to} on ${formatDate(order.sent_at, 'dd MMM yyyy')}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {order && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => { setSendError(null); sendMutation.mutate(v) })} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="to" render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl><Input type="email" placeholder="supplier@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cc" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cc <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input type="email" placeholder="A copy for yourself" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl><Textarea rows={8} className="text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <button
                type="button"
                onClick={downloadPdf}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-2">
                  <RiAttachment2 className="size-4 text-muted-foreground" />
                  <span className="font-medium">{order.id}.pdf</span>
                  <span className="text-xs text-muted-foreground">attached</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-primary">
                  {downloading ? <RiLoader4Line className="size-3.5 animate-spin" /> : <RiDownloadLine className="size-3.5" />}
                  Download
                </span>
              </button>

              {isApproved && (
                <FormField control={form.control} name="markOrdered" render={({ field }) => (
                  <FormItem className="flex items-start gap-2.5 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(!!checked)} className="mt-0.5" />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Mark the order as placed once it’s sent</FormLabel>
                      <p className="text-xs text-muted-foreground">Moves {order.id} to Ordered, ready to receive the goods.</p>
                    </div>
                  </FormItem>
                )} />
              )}

              {sendError && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <RiAlertLine className="mt-0.5 size-4 shrink-0" />
                  {sendError}
                </p>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                {isApproved ? (
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => markMutation.mutate()}>
                    {markMutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                    Sent another way — mark as ordered
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
                  <Button type="submit" disabled={busy} className="gap-1.5">
                    {sendMutation.isPending ? <RiLoader4Line className="size-4 animate-spin" /> : <RiMailSendLine className="size-4" />}
                    Send email
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
