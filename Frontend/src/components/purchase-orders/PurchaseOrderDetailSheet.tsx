import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiArrowDownSLine,
  RiBankCardLine,
  RiBox3Line,
  RiCloseCircleLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiFileEditLine,
  RiFileTextLine,
  RiHistoryLine,
  RiLoader4Line,
  RiMailSendLine,
  RiMapPinLine,
  RiMoneyDollarCircleLine,
  RiMore2Line,
  RiStickyNoteLine,
  RiTruckLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/api/suppliers.api'
import { usersApi } from '@/api/users.api'
import { companyProfileApi } from '@/api/company-profile.api'
import { PurchaseOrder, PurchaseOrderStatus } from '@/types/supplier.types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { downloadFile } from '@/utils/helpers'
import { purchaseOrderLineDetail, purchaseOrderToPreviewData } from '@/utils/purchaseOrderPreview'
import {
  DrawerLoadingBar,
  DrawerRow,
  DrawerSection,
  DrawerViewSwitch,
  LineItemList,
  MoneyStrip,
  TotalsBlock,
  type DrawerLineItem,
} from '@/components/common/DetailDrawer'
import PurchaseOrderPreview from './PurchaseOrderPreview'
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge'
import { PurchaseOrderStepper } from './PurchaseOrderStepper'
import { PurchaseOrderTimeline } from './PurchaseOrderTimeline'
import { getPONextAction } from './PurchaseOrderWorkflowActions'
import ReceiveGoodsDialog from './ReceiveGoodsDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'
import { RecordSupplierPaymentDialog, type PayableSupplierInvoice } from './RecordSupplierPaymentDialog'
import { SendPurchaseOrderDialog } from './SendPurchaseOrderDialog'

interface Props {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// What to do next, in plain words, under the order's numbers
const NEXT_STEP_NOTES: Partial<Record<PurchaseOrderStatus, string>> = {
  Draft: 'Approve it to lock the order before sending it',
  Approved: 'Send it to the supplier to place the order',
  Ordered: 'Receive the goods when they arrive',
  'Partially Received': 'Some items are still to come',
  Received: 'Add the supplier’s invoice to pay them',
}

const RECEIVABLE: PurchaseOrderStatus[] = ['Ordered', 'Partially Received']
// Approved onwards an order can be paid ahead, until its invoice arrives
const PAYABLE_AHEAD: PurchaseOrderStatus[] = ['Approved', 'Ordered', 'Partially Received', 'Received']
const METHOD_LABELS: Record<string, string> = { cash: 'Cash', 'bank-transfer': 'Bank transfer', cheque: 'Cheque', card: 'Card', upi: 'UPI' }
const INVOICEABLE: PurchaseOrderStatus[] = ['Partially Received', 'Received', 'Closed']

export function PurchaseOrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'details' | 'copy'>('details')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<PayableSupplierInvoice | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Switching to another order keeps the drawer open and starts at the top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [orderId])

  // keepPreviousData: the current order stays on screen while the next one loads
  const { data: order, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => suppliersApi.getPurchaseOrder(orderId!),
    enabled: open && !!orderId,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetching && isPlaceholderData

  // The supplier's invoice for this order (if any) and what's been paid on it
  const supplierInvoice = order?.supplier_invoice ?? undefined
  const paid = supplierInvoice?.paid_amount ?? 0
  const invoiceBalance = supplierInvoice?.balance_due ?? 0
  // Everything paid on the order — advances and payments against its invoice
  const { data: paymentsData } = useQuery({
    queryKey: ['supplier-payments', 'by-order', order?.id],
    queryFn: () => suppliersApi.getSupplierPayments({ page: 1, page_size: 100, purchase_order_id: order!.id }),
    enabled: open && !!order && order.status !== 'Draft',
    staleTime: 0,
  })
  const payments = paymentsData?.data ?? []
  const advancePaid = order?.advance_paid ?? 0
  const canPayAhead = !!order && !supplierInvoice && PAYABLE_AHEAD.includes(order.status)
  const aheadRemaining = order ? Math.max(order.total_amount - advancePaid, 0) : 0

  const payable: PayableSupplierInvoice | null = order && supplierInvoice
    ? {
        id: supplierInvoice.id,
        invoice_number: supplierInvoice.invoice_number,
        total_amount: supplierInvoice.total_amount,
        paid_amount: paid,
        purchase_order_id: order.id,
        supplier_name: order.supplier_information?.supplier_name,
      }
    : null

  // Staff names for "Approved by" (shared cache with the sales screens)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const users: Array<{ user_id: string; name: string }> = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
  const nameOf = (userId?: string) => (userId ? users.find((u) => u.user_id === userId)?.name ?? userId : undefined)

  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
    enabled: open && view === 'copy',
  })

  const refresh = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] })
    queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
  }

  const moveTo = async (target: PurchaseOrderStatus, success: string) => {
    if (!order) return
    setAdvancing(true)
    try {
      await suppliersApi.updatePurchaseOrderStatus(order.id, target)
      refresh(order.id)
      toast.success(success)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Update failed')
    } finally {
      setAdvancing(false)
    }
  }

  const handleDownloadPdf = async (record = false) => {
    if (!order) return
    setDownloading(true)
    try {
      downloadFile(await suppliersApi.downloadPurchaseOrderPdf(order.id, { record }), record ? `${order.id}-record.pdf` : `${order.id}.pdf`)
      toast.success(record ? 'Purchase record downloaded' : 'PDF downloaded')
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

  // ── The one main action for where the order is ──
  const workflow = order ? getPONextAction(order.status) : null
  const primary: { label: string; icon: React.ComponentType<{ className?: string }>; className?: string; run: () => void } | null = !order
    ? null
    : order.status === 'Approved' && workflow
      ? { label: workflow.label, icon: workflow.icon, className: workflow.className, run: () => setSendOpen(true) }
    : RECEIVABLE.includes(order.status) && workflow
      ? { label: workflow.label, icon: workflow.icon, className: workflow.className, run: () => setReceiveOpen(true) }
      : order.status === 'Received' && !supplierInvoice
        ? { label: 'Add Supplier Invoice', icon: RiMoneyDollarCircleLine, className: workflow?.className, run: () => setInvoiceOpen(true) }
        : supplierInvoice && invoiceBalance > 0
          ? { label: `Pay Supplier · ${formatCurrency(invoiceBalance)}`, icon: RiMoneyDollarCircleLine, className: 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600', run: () => setPayInvoice(payable) }
          : workflow && !workflow.requiresDialog
            ? { label: workflow.label, icon: workflow.icon, className: workflow.className, run: () => moveTo(workflow.toStatus, `${order.id} → ${workflow.toStatus.toLowerCase()}`) }
            : null

  // ── Numbers ──
  const orderedUnits = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const trackedUnits = order?.items.reduce((sum, item) => sum + Math.min(item.received_quantity ?? 0, item.quantity), 0) ?? 0
  // Orders received before per-line tracking existed carry no counts; their status is the record
  const untrackedReceipt = !!order && ['Received', 'Closed'].includes(order.status) && trackedUnits === 0
  const receivedOf = (item: PurchaseOrder['items'][number]) =>
    untrackedReceipt ? item.quantity : Math.min(item.received_quantity ?? 0, item.quantity)
  const receivedUnits = untrackedReceipt ? orderedUnits : trackedUnits
  const receivingStarted = !!order && (receivedUnits > 0 || ['Partially Received', 'Received', 'Closed'].includes(order.status))
  const summary = order?.order_summary

  const lineItems: DrawerLineItem[] = (order?.items ?? []).map((item, index) => {
    const received = receivedOf(item)
    return {
      key: item.id || `${item.product_id}-${index}`,
      name: item.item_name || item.product_id,
      detail: purchaseOrderLineDetail(item) || undefined,
      qty: item.quantity,
      unitPrice: item.unit_cost,
      total: item.total_price ?? item.quantity * item.unit_cost,
      note: receivingStarted ? (received >= item.quantity ? 'All received' : `${received} of ${item.quantity} received`) : undefined,
      noteTone: received >= item.quantity ? 'success' : 'warning',
    }
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col sm:max-w-lg overflow-hidden p-0">
          {/* ── Header: number, status, supplier on one line ── */}
          <SheetHeader className="flex-shrink-0 space-y-1 border-b px-5 pb-4 pt-5">
            <SheetTitle className="pr-20 text-base font-semibold text-foreground">{order?.id ?? '…'}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {order && <PurchaseOrderStatusBadge status={order.status} />}
                {order && <span className="font-medium text-foreground">{order.supplier_information?.supplier_name || order.supplier_id}</span>}
                {order && <span>· {formatDate(order.order_date)}</span>}
              </div>
            </SheetDescription>
          </SheetHeader>
          <DrawerLoadingBar active={isSwitching} />

          {/* ── Scrollable body ── */}
          <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
            {!order ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <RiLoader4Line className="size-4 animate-spin" />
                Loading order…
              </div>
            ) : (
              <>
                <div className="space-y-4 border-b px-5 py-4">
                  <PurchaseOrderStepper status={order.status} />
                  {supplierInvoice ? (
                    <MoneyStrip
                      total={supplierInvoice.total_amount}
                      paid={paid}
                      balance={invoiceBalance}
                      onRecordPayment={invoiceBalance > 0 ? () => setPayInvoice(payable) : undefined}
                      actionLabel="Pay supplier"
                      note={
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => goTo(`/supplier-invoices?detail=${supplierInvoice.id}`)}>
                          Invoice {supplierInvoice.invoice_number} ›
                        </button>
                      }
                    />
                  ) : (
                    <div className="rounded-xl border border-border">
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] text-muted-foreground">Order total</p>
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(order.total_amount)}</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] text-muted-foreground">{receivingStarted ? 'Received' : 'Units'}</p>
                          <p className={cn('text-sm font-semibold tabular-nums', receivingStarted && receivedUnits < orderedUnits && 'text-amber-600 dark:text-amber-400', receivingStarted && receivedUnits >= orderedUnits && 'text-emerald-600 dark:text-emerald-400')}>
                            {receivingStarted ? `${receivedUnits} of ${orderedUnits}` : orderedUnits}
                          </p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] text-muted-foreground">Expected</p>
                          <p className="text-sm font-semibold">{order.expected_delivery_date ? formatDate(order.expected_delivery_date, 'dd MMM') : '—'}</p>
                        </div>
                      </div>
                      {receivingStarted && orderedUnits > 0 && (
                        <div className="h-1 bg-muted">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (receivedUnits / orderedUnits) * 100)}%` }} />
                        </div>
                      )}
                      {(NEXT_STEP_NOTES[order.status] || order.sent_at) && (
                        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                          {order.sent_at && order.status !== 'Draft' && (
                            <span className="text-foreground">Emailed to {order.sent_to} on {formatDate(order.sent_at, 'dd MMM')}. </span>
                          )}
                          {NEXT_STEP_NOTES[order.status]}
                        </p>
                      )}
                      {(canPayAhead || advancePaid > 0) && (
                        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
                          <span className="min-w-0 text-muted-foreground">
                            {advancePaid > 0 ? (
                              <>
                                Paid ahead <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(advancePaid)}</span>
                                {' '}· counts against the invoice
                              </>
                            ) : (
                              'Supplier wants payment up front?'
                            )}
                          </span>
                          {canPayAhead && aheadRemaining > 0 && (
                            <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => setAdvanceOpen(true)}>
                              <RiMoneyDollarCircleLine className="size-3.5" />
                              Pay in advance
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <DrawerViewSwitch
                    value={view}
                    onChange={setView}
                    options={[
                      { value: 'details', label: 'Details' },
                      { value: 'copy', label: 'Supplier copy' },
                    ]}
                  />
                </div>

                {view === 'copy' ? (
                  <div className="px-5 py-4">
                    <PurchaseOrderPreview data={purchaseOrderToPreviewData(order, nameOf(order.authorization?.approved_by))} company={companyProfile} />
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <DrawerSection icon={RiBox3Line} title={`Items (${lineItems.length})`}>
                      <LineItemList items={lineItems} />
                      <TotalsBlock
                        subtotal={summary?.subtotal ?? order.total_amount}
                        discount={(summary?.discount ?? 0) + (summary?.line_discount_total ?? 0)}
                        charges={[
                          { label: 'Tax', amount: summary?.tax_amount ?? 0 },
                          { label: 'Delivery charge', amount: summary?.shipping_cost ?? 0 },
                        ]}
                        total={order.total_amount}
                      />
                    </DrawerSection>

                    <DrawerSection icon={RiTruckLine} title="Supplier">
                      <DrawerRow label="Supplier" value={order.supplier_information?.supplier_name || order.supplier_id} />
                      {order.supplier_information?.contact_person && <DrawerRow label="Contact" value={order.supplier_information.contact_person} />}
                      {order.supplier_information?.phone && <DrawerRow label="Phone" value={order.supplier_information.phone} />}
                      {order.supplier_information?.email && <DrawerRow label="Email" value={order.supplier_information.email} />}
                      {order.payment_terms?.payment_terms && <DrawerRow label="Terms" value={order.payment_terms.payment_terms} />}
                      {supplierInvoice && (
                        <DrawerRow
                          label="Invoice"
                          value={
                            <button type="button" className="font-medium text-primary hover:underline" onClick={() => goTo(`/supplier-invoices?detail=${supplierInvoice.id}`)}>
                              {supplierInvoice.invoice_number} · {supplierInvoice.status === 'Paid' ? 'paid' : `${formatCurrency(invoiceBalance)} to pay`}
                            </button>
                          }
                        />
                      )}
                    </DrawerSection>

                    {order.status !== 'Draft' && (
                      <DrawerSection icon={RiBankCardLine} title={`Payments${payments.length ? ` (${payments.length})` : ''}`}>
                        {payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
                        ) : (
                          <ul className="divide-y divide-border/70">
                            {payments.map((payment) => (
                              <li key={payment.id} className="flex items-start justify-between gap-3 py-2">
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 text-sm font-medium">
                                    {formatDate(payment.payment_date)}
                                    <span className={cn(
                                      'rounded-full px-1.5 py-px text-[10px] font-medium',
                                      payment.is_advance ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' : 'bg-muted text-muted-foreground',
                                    )}>
                                      {payment.is_advance ? 'Advance' : `Invoice ${payment.invoice_number ?? ''}`.trim()}
                                    </span>
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
                    )}

                    <DrawerSection icon={RiMapPinLine} title="Delivery">
                      <DrawerRow label="Expected" value={order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'Not set'} />
                      {order.shipping_information?.ship_to_location && <DrawerRow label="Ship to" value={order.shipping_information.ship_to_location} />}
                      {order.shipping_information?.receiving_department && <DrawerRow label="Received by" value={order.shipping_information.receiving_department} />}
                      {order.shipping_information?.delivery_address && <DrawerRow label="Address" value={order.shipping_information.delivery_address} />}
                      {order.shipping_information?.delivery_instructions && <DrawerRow label="Instructions" value={order.shipping_information.delivery_instructions} />}
                    </DrawerSection>

                    {(order.notes?.supplier_notes || order.notes?.internal_notes) && (
                      <DrawerSection icon={RiStickyNoteLine} title="Notes">
                        {order.notes?.supplier_notes && (
                          <div className="space-y-0.5 text-sm">
                            <p className="text-xs text-muted-foreground">To the supplier · printed</p>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">{order.notes.supplier_notes}</p>
                          </div>
                        )}
                        {order.notes?.internal_notes && (
                          <div className="mt-3 space-y-0.5 text-sm">
                            <p className="text-xs text-muted-foreground">Internal · never printed</p>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">{order.notes.internal_notes}</p>
                          </div>
                        )}
                      </DrawerSection>
                    )}

                    {/* History stays tucked away until it's needed */}
                    <Collapsible>
                      <CollapsibleTrigger className="group flex w-full items-center justify-between px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-1.5">
                          <RiHistoryLine className="size-3.5" />
                          History{order.status_history?.length ? ` (${order.status_history.length + 1})` : ''}
                        </span>
                        <RiArrowDownSLine className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-5 pb-4">
                        <PurchaseOrderTimeline history={order.status_history ?? []} createdAt={order.created_at} createdBy={nameOf(order.created_by)} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer: one main action, the rest tidy ── */}
          {order && (
            <div className="flex flex-shrink-0 flex-col gap-2 border-t bg-background px-5 py-3">
              {primary && (
                <Button className={cn('w-full gap-2 font-semibold', primary.className)} onClick={primary.run} disabled={advancing}>
                  {advancing ? <RiLoader4Line className="size-4 animate-spin" /> : <primary.icon className="size-4" />}
                  {primary.label}
                </Button>
              )}
              <div className="flex gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 gap-1.5" disabled={downloading}>
                      {downloading ? <RiLoader4Line className="size-4 animate-spin" /> : <RiDownloadLine className="size-4" />}
                      PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="w-64">
                    <DropdownMenuItem onClick={() => handleDownloadPdf(false)} className="flex-col items-start gap-0">
                      <span className="font-medium">Purchase order</span>
                      <span className="text-xs text-muted-foreground">The copy you send the supplier</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadPdf(true)} className="flex-col items-start gap-0">
                      <span className="font-medium">Purchase record</span>
                      <span className="text-xs text-muted-foreground">Order, what arrived, the invoice and payments</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {order.status === 'Draft' ? (
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => goTo(`/purchase-orders/new?draft=${order.id}`)}>
                    <RiFileEditLine className="size-4" />
                    Edit draft
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => goTo(`/purchase-orders/new?copy=${order.id}`)}>
                    <RiFileCopyLine className="size-4" />
                    Order again
                  </Button>
                )}
                <OrderMoreMenu
                  order={order}
                  onCopy={() => goTo(`/purchase-orders/new?copy=${order.id}`)}
                  onInvoice={!supplierInvoice && INVOICEABLE.includes(order.status) && order.status !== 'Closed' ? () => setInvoiceOpen(true) : undefined}
                  onResend={['Ordered', 'Partially Received', 'Received'].includes(order.status) ? () => setSendOpen(true) : undefined}
                  onOpenInvoice={supplierInvoice ? () => goTo(`/supplier-invoices?detail=${supplierInvoice.id}`) : undefined}
                  onPayAhead={canPayAhead && aheadRemaining > 0 ? () => setAdvanceOpen(true) : undefined}
                  onClose={order.status === 'Partially Received' ? () => setCloseConfirmOpen(true) : undefined}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Closing a short-shipped order */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {order?.id} without the rest?</AlertDialogTitle>
            <AlertDialogDescription>
              {receivedUnits} of {orderedUnits} units arrived. Closing stops waiting for the remaining {orderedUnits - receivedUnits}; stock already received stays as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep waiting</AlertDialogCancel>
            <AlertDialogAction onClick={() => moveTo('Closed', `${order?.id} closed`)}>Close order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {order && (
        <>
          <ReceiveGoodsDialog
            isOpen={receiveOpen}
            order={order}
            onClose={() => setReceiveOpen(false)}
            onSuccess={(updated) => {
              setReceiveOpen(false)
              refresh(order.id)
              queryClient.invalidateQueries({ queryKey: ['products'] })
              queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
              queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] })
              // Everything's in — the supplier's invoice is the next thing to record
              if (updated?.status === 'Received') setInvoiceOpen(true)
            }}
          />
          <CreateSupplierInvoiceDialog
            isOpen={invoiceOpen}
            order={order}
            onClose={() => setInvoiceOpen(false)}
            onSuccess={(invoice) => {
              setInvoiceOpen(false)
              refresh(order.id)
              // Straight on to paying what's left after any advances; paying in full closes the order
              if ((invoice.balance_due ?? invoice.total_amount) > 0) setPayInvoice(invoice)
              else toast.success(`${invoice.invoice_number} is already covered by the advance`)
            }}
          />
          <RecordSupplierPaymentDialog
            open={!!payInvoice}
            onClose={() => setPayInvoice(null)}
            onSuccess={() => refresh(order.id)}
            supplierInvoice={payInvoice}
          />
          <SendPurchaseOrderDialog order={order} open={sendOpen} onClose={() => setSendOpen(false)} />
          <RecordSupplierPaymentDialog
            open={advanceOpen}
            onClose={() => setAdvanceOpen(false)}
            onSuccess={() => refresh(order.id)}
            advanceFor={{ orderId: order.id, orderTotal: order.total_amount, advancePaid, supplierName: order.supplier_information?.supplier_name }}
          />
        </>
      )}
    </>
  )
}

function OrderMoreMenu({
  order,
  onCopy,
  onInvoice,
  onResend,
  onOpenInvoice,
  onPayAhead,
  onClose,
}: {
  order: PurchaseOrder
  onCopy: () => void
  onInvoice?: () => void
  onResend?: () => void
  onOpenInvoice?: () => void
  onPayAhead?: () => void
  onClose?: () => void
}) {
  // Nothing extra to offer at this stage
  if (order.status !== 'Draft' && !onInvoice && !onResend && !onOpenInvoice && !onPayAhead && !onClose) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5" aria-label="More actions">
          <RiMore2Line className="size-4" />
          More
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52">
        {order.status === 'Draft' && (
          <DropdownMenuItem onClick={onCopy}>
            <RiFileCopyLine className="size-4" />
            Order again
          </DropdownMenuItem>
        )}
        {onResend && (
          <DropdownMenuItem onClick={onResend}>
            <RiMailSendLine className="size-4" />
            {order.sent_at ? 'Send to supplier again' : 'Email to supplier'}
          </DropdownMenuItem>
        )}
        {onPayAhead && (
          <DropdownMenuItem onClick={onPayAhead}>
            <RiMoneyDollarCircleLine className="size-4" />
            Pay in advance
          </DropdownMenuItem>
        )}
        {onOpenInvoice && (
          <DropdownMenuItem onClick={onOpenInvoice}>
            <RiFileTextLine className="size-4" />
            Open supplier invoice
          </DropdownMenuItem>
        )}
        {onInvoice && (
          <DropdownMenuItem onClick={onInvoice}>
            <RiMoneyDollarCircleLine className="size-4" />
            Add supplier invoice
          </DropdownMenuItem>
        )}
        {onClose && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onClose}>
              <RiCloseCircleLine className="size-4" />
              Close — rest won’t come
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
