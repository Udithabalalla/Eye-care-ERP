import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RiDownloadLine,
  RiMoneyDollarCircleLine,
  RiLoader4Line,
  RiArrowRightSLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { downloadFile } from '@/utils/helpers'
import { formatDate, formatCurrency } from '@/utils/formatters'
import { RecordPaymentDialog } from '@/components/common/RecordPaymentDialog'
import InvoiceDetail from './InvoiceDetail'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  pending: 'outline',
  overdue: 'destructive',
}

interface Props {
  invoiceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvoiceDetailSheet({ invoiceId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.getById(invoiceId!),
    enabled: open && !!invoiceId,
    staleTime: 0,
  })

  const handleDownloadPDF = async () => {
    if (!invoice) return
    setDownloading(true)
    try {
      const blob = await invoicesApi.downloadPDF(invoice.invoice_id)
      downloadFile(blob, `invoice-${invoice.invoice_number}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const isPaid = invoice?.payment_status === 'paid'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0"
        >
          {/* ── Header ─────────────────────────────── */}
          <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
            <div className="flex items-start gap-3 pr-8">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold text-foreground">
                  {invoice?.invoice_number ?? '…'}
                </SheetTitle>
                <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  {invoice && (
                    <Badge
                      variant={statusVariant[invoice.payment_status] ?? 'outline'}
                      className="capitalize text-xs"
                    >
                      {invoice.payment_status}
                    </Badge>
                  )}
                  {invoice?.invoice_date && (
                    <span className="text-xs text-muted-foreground">
                      Issued {formatDate(invoice.invoice_date)}
                    </span>
                  )}
                  {invoice?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      · Due {formatDate(invoice.due_date)}
                    </span>
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* ── Body ─────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading && (
              <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                <RiLoader4Line className="size-5 animate-spin" />
                <span className="text-sm">Loading invoice…</span>
              </div>
            )}
            {invoice && (
              <InvoiceDetail
                invoice={invoice}
                showHeader={false}
                onPayment={() => setPaymentOpen(true)}
                onDownloadPDF={handleDownloadPDF}
              />
            )}
          </div>

          {/* ── Footer ─────────────────────────────── */}
          {invoice && (
            <div className="border-t px-6 py-4 flex-shrink-0 space-y-3">
              {/* Balance indicator */}
              {invoice.balance_due > 0 && (
                <div className="rounded-lg bg-destructive/10 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">Balance Due</span>
                  <span className="text-sm font-bold text-destructive">
                    {formatCurrency(invoice.balance_due)}
                  </span>
                </div>
              )}
              {isPaid && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/20 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Fully Paid</span>
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                >
                  {downloading ? (
                    <RiLoader4Line className="size-4 animate-spin" />
                  ) : (
                    <RiDownloadLine className="size-4" />
                  )}
                  Download PDF
                </Button>
                {!isPaid && (
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={() => setPaymentOpen(true)}
                  >
                    <RiMoneyDollarCircleLine className="size-4" />
                    Record Payment
                  </Button>
                )}
                {invoice.sales_order_id && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      onOpenChange(false)
                      navigate(`/sales-orders?detail=${invoice.sales_order_id}`)
                    }}
                  >
                    View SO
                    <RiArrowRightSLine className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment dialog */}
      {invoice && (
        <RecordPaymentDialog
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
            queryClient.invalidateQueries({ queryKey: ['invoices'] })
          }}
          referenceType="INVOICE"
          referenceId={invoice.invoice_id}
          totalAmount={invoice.total_amount}
          paidAmount={invoice.paid_amount}
          patientName={invoice.patient_name}
          invoiceNumber={invoice.invoice_number}
          invalidateKeys={[['invoices']]}
        />
      )}
    </>
  )
}
