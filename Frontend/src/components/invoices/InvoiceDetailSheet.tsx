import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices.api'
import { companyProfileApi } from '@/api/company-profile.api'
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
  RiBox3Line,
  RiUserLine,
  RiBankCardLine,
  RiStickyNoteLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { downloadFile } from '@/utils/helpers'
import { formatDate } from '@/utils/formatters'
import { RecordPaymentDialog } from '@/components/common/RecordPaymentDialog'
import {
  DrawerLoadingBar,
  DrawerRow,
  DrawerSection,
  DrawerViewSwitch,
  LineItemList,
  MoneyStrip,
  TotalsBlock,
} from '@/components/common/DetailDrawer'
import InvoicePreview, { InvoicePreviewStatus } from '@/components/sales-orders/InvoicePreview'
import { invoiceToPreviewData } from '@/utils/invoicePreview'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  pending: 'outline',
  overdue: 'destructive',
}

// Free items already say "Free" in the amount column
const LINE_LABELS: Record<string, string> = { frame: 'Frame', lens: 'Lens', expense: 'Service' }

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
  const [view, setView] = useState<'details' | 'invoice'>('details')
  const bodyRef = useRef<HTMLDivElement>(null)

  // Switching to another invoice keeps the drawer open and starts at the top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [invoiceId])

  // keepPreviousData: the current invoice stays on screen while the next one loads
  const { data: invoice, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.getById(invoiceId!),
    enabled: open && !!invoiceId,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetching && isPlaceholderData

  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
    enabled: open && view === 'invoice',
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

  const goTo = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  const hasBalance = !!invoice && invoice.balance_due > 0 && invoice.payment_status !== 'cancelled'
  const preview = invoice ? invoiceToPreviewData(invoice) : null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col sm:max-w-lg overflow-hidden p-0">
          {/* ── Header: number, status, key facts on one line ── */}
          <SheetHeader className="flex-shrink-0 space-y-1 border-b px-5 pb-4 pt-5">
            <SheetTitle className="pr-20 text-base font-semibold text-foreground">
              {invoice?.invoice_number ?? '…'}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {invoice && (
                  <Badge variant={statusVariant[invoice.payment_status] ?? 'outline'} className="capitalize text-xs">
                    {invoice.payment_status}
                  </Badge>
                )}
                {invoice?.patient_name && <span className="font-medium text-foreground">{invoice.patient_name}</span>}
                {invoice?.invoice_date && <span>· Issued {formatDate(invoice.invoice_date, 'MMM d')}</span>}
                {invoice?.due_date && <span>· Due {formatDate(invoice.due_date, 'MMM d, yyyy')}</span>}
              </div>
            </SheetDescription>
          </SheetHeader>
          <DrawerLoadingBar active={isSwitching} />

          {/* ── Body ─────────────────────────────── */}
          <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
            {!invoice || !preview ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <RiLoader4Line className="size-4 animate-spin" />
                Loading invoice…
              </div>
            ) : (
              <>
                <div className="space-y-4 border-b px-5 py-4">
                  <MoneyStrip
                    total={invoice.total_amount}
                    paid={invoice.paid_amount}
                    balance={invoice.payment_status === 'cancelled' ? 0 : invoice.balance_due}
                    note={invoice.payment_status === 'cancelled' ? 'Cancelled invoice' : hasBalance ? `Due by ${formatDate(invoice.due_date)}` : undefined}
                  />
                  <DrawerViewSwitch
                    value={view}
                    onChange={setView}
                    options={[
                      { value: 'details', label: 'Details' },
                      { value: 'invoice', label: 'Invoice copy' },
                    ]}
                  />
                </div>

                {view === 'invoice' ? (
                  <div className="space-y-2 px-5 py-4">
                    <InvoicePreview data={preview} company={companyProfile} />
                    <InvoicePreviewStatus data={preview} />
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <DrawerSection icon={RiBox3Line} title={`Items (${invoice.items.length})`}>
                      <LineItemList
                        items={invoice.items.map((item, i) => ({
                          key: `${item.product_id}-${i}`,
                          name: item.product_name,
                          detail: [item.line_type && item.line_type !== 'product' ? LINE_LABELS[item.line_type] : undefined, item.sku].filter(Boolean).join(' · '),
                          qty: item.quantity,
                          unitPrice: item.unit_price,
                          total: item.total,
                          isFree: item.line_type === 'complimentary',
                        }))}
                      />
                      <TotalsBlock subtotal={invoice.subtotal} discount={invoice.total_discount} total={invoice.total_amount} />
                    </DrawerSection>

                    <DrawerSection icon={RiUserLine} title="Patient">
                      <DrawerRow label="Name" value={invoice.patient_name} />
                      {invoice.patient_phone && <DrawerRow label="Phone" value={invoice.patient_phone} />}
                      {invoice.patient_email && <DrawerRow label="Email" value={invoice.patient_email} />}
                      {invoice.sales_order_id && (
                        <DrawerRow
                          label="Sales order"
                          value={
                            <button type="button" className="inline-flex items-center font-medium text-primary hover:underline" onClick={() => goTo(`/sales-orders?detail=${invoice.sales_order_id}`)}>
                              {invoice.sales_order_id}
                              <RiArrowRightSLine className="size-4" />
                            </button>
                          }
                        />
                      )}
                    </DrawerSection>

                    {(invoice.payment_method || invoice.payment_date || invoice.transaction_id) && (
                      <DrawerSection icon={RiBankCardLine} title="Last payment">
                        {invoice.payment_method && <DrawerRow label="Method" value={<span className="capitalize">{invoice.payment_method}</span>} />}
                        {invoice.payment_date && <DrawerRow label="Paid on" value={formatDate(invoice.payment_date)} />}
                        {invoice.transaction_id && <DrawerRow label="Reference" value={invoice.transaction_id} mono />}
                      </DrawerSection>
                    )}

                    {invoice.notes && (
                      <DrawerSection icon={RiStickyNoteLine} title="Notes">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{invoice.notes}</p>
                      </DrawerSection>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer: one main action ─────────── */}
          {invoice && (
            <div className="flex flex-shrink-0 flex-col gap-2 border-t bg-background px-5 py-3">
              {hasBalance && (
                <Button className="w-full gap-1.5 font-semibold" onClick={() => setPaymentOpen(true)}>
                  <RiMoneyDollarCircleLine className="size-4" />
                  Record payment
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={handleDownloadPDF} disabled={downloading}>
                  {downloading ? <RiLoader4Line className="size-4 animate-spin" /> : <RiDownloadLine className="size-4" />}
                  Download PDF
                </Button>
                {invoice.sales_order_id && (
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => goTo(`/sales-orders?detail=${invoice.sales_order_id}`)}>
                    Sales order
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
          invoice={invoice}
          invalidateKeys={[['invoices']]}
        />
      )}
    </>
  )
}
