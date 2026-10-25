import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { salesOrdersApi, auditLogsApi } from '@/api/erp.api'
import { invoicesApi } from '@/api/invoices.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { usersApi } from '@/api/users.api'
import { companyProfileApi } from '@/api/company-profile.api'
import { AuditLog } from '@/types/erp.types'
import { SalesOrderStatus } from '@/types/erp.types'
import { Prescription } from '@/types/prescription.types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  RiFileEditLine,
  RiReceiptLine,
  RiLoader4Line,
  RiBox3Line,
  RiSettings4Line,
  RiShieldCheckLine,
  RiTruckLine,
  RiUserLine,
  RiStickyNoteLine,
  RiEyeLine,
  RiRefreshLine,
  RiHistoryLine,
  RiDeleteBin6Line,
  RiDownloadLine,
  RiMore2Line,
  RiArrowDownSLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { downloadFile } from '@/utils/helpers'
import { SalesOrderStatusBadge } from './SalesOrderStatusBadge'
import { SalesOrderStepper } from './SalesOrderStepper'
import { SalesOrderTimeline } from './SalesOrderTimeline'
import { getNextAction } from './SalesOrderWorkflowActions'
import { RecordPaymentDialog } from '@/components/common/RecordPaymentDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DrawerLoadingBar, DrawerRow, DrawerSection, DrawerViewSwitch, LineItemList, MoneyStrip, TotalsBlock, type DrawerLineItem } from '@/components/common/DetailDrawer'
import InvoicePreview, { InvoicePreviewStatus } from '@/components/sales-orders/InvoicePreview'
import { invoiceToPreviewData } from '@/utils/invoicePreview'

const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lens_ordered: RiBox3Line,
  fitting: RiSettings4Line,
  ready: RiShieldCheckLine,
  delivered: RiTruckLine,
}

// Free items already say "Free" in the amount column
const LINE_LABELS: Record<string, string> = { frame: 'Frame', lens: 'Lens', expense: 'Service' }

interface Props {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SalesOrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [view, setView] = useState<'details' | 'invoice'>('details')
  const bodyRef = useRef<HTMLDivElement>(null)

  // Switching to another order keeps the drawer open and starts at the top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [orderId])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
      onOpenChange(false)
      toast.success('Draft order deleted')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete order')
    },
  })

  // keepPreviousData: the current order stays on screen while the next one loads
  const { data: order, isFetching: isFetchingOrder, isPlaceholderData } = useQuery({
    queryKey: ['sales-order', orderId],
    queryFn: () => salesOrdersApi.getById(orderId!),
    enabled: open && !!orderId,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetchingOrder && isPlaceholderData

  const { data: prescription, isLoading: isLoadingRx } = useQuery({
    queryKey: ['prescription', order?.prescription_id],
    queryFn: () => prescriptionsApi.getById(order!.prescription_id!),
    enabled: open && !!order?.prescription_id,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Fetch invoice when SO has one linked (to get live balance_due)
  const { data: invoice } = useQuery({
    queryKey: ['invoice', order?.invoice_id],
    queryFn: () => invoicesApi.getById(order!.invoice_id!),
    enabled: open && !!order?.invoice_id,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const orderInvoice = invoice && order?.invoice_id === invoice.invoice_id ? invoice : undefined

  // Audit trail for this order
  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'sales-order', orderId],
    queryFn: () => auditLogsApi.getAll({ page: 1, page_size: 50, entity_type: 'sales_order', entity_id: orderId! }),
    enabled: open && !!orderId,
    staleTime: 30_000,
  })
  const auditLogs = auditData?.data ?? []

  // Staff names for "Tested by" (shared cache with the order wizard)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const users: Array<{ user_id: string; name: string }> = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
  const testedByName = order?.tested_by ? (users.find((u) => u.user_id === order.tested_by)?.name ?? order.tested_by) : undefined

  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
    enabled: open && view === 'invoice',
  })

  const handleDownloadPDF = async () => {
    if (!order) return
    setDownloading(true)
    try {
      const blob = await salesOrdersApi.downloadPDF(order.order_id)
      downloadFile(blob, `${order.order_number}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SalesOrderStatus }) =>
      salesOrdersApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['sales-order', id] })
      const previous = queryClient.getQueryData(['sales-order', id])
      queryClient.setQueryData(['sales-order', id], (old: any) => old ? { ...old, status } : old)
      queryClient.setQueriesData({ queryKey: ['sales-orders'] }, (old: any) => {
        if (!old?.data) return old
        return { ...old, data: old.data.map((o: any) => o.order_id === id ? { ...o, status } : o) }
      })
      return { previous }
    },
    onError: (error: any, { id }, context: any) => {
      if (context?.previous) queryClient.setQueryData(['sales-order', id], context.previous)
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-ready-count'] })
    },
  })

  const nextAction = order ? getNextAction(order.status) : null
  const Icon = nextAction ? (WORKFLOW_ICONS[nextAction.toStatus] ?? RiBox3Line) : null
  const isPending = statusMutation.isPending

  const handleAdvance = () => {
    if (!nextAction || !order) return
    toast.promise(
      salesOrdersApi.updateStatus(order.order_id, nextAction.toStatus).then((updated) => {
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
        queryClient.invalidateQueries({ queryKey: ['sales-order', order.order_id] })
        return updated
      }),
      {
        loading: 'Updating status…',
        success: `Moved to "${nextAction.label}"`,
        error: (err: any) => err?.response?.data?.detail || 'Update failed',
      },
    )
  }

  const measurements = order?.measurements as Record<string, unknown> | undefined
  const advancePayment = Number(measurements?.advance_payment || 0)
  const orderDate = measurements?.order_date as string | undefined
  const discount = Number(order?.discount_amount || measurements?.discount || 0)

  // Money: the invoice is the source of truth once it exists
  const total = orderInvoice?.total_amount ?? order?.total_amount ?? 0
  const paid = orderInvoice?.paid_amount ?? advancePayment
  const balance = orderInvoice ? orderInvoice.balance_due : Math.max(total - paid, 0)
  const deliveryBlocked = nextAction?.toStatus === 'delivered' && !!orderInvoice && orderInvoice.balance_due > 0

  const lineItems: DrawerLineItem[] = (order?.items ?? []).map((item, i) => ({
    key: `${item.product_id}-${i}`,
    name: item.product_name || item.product_id,
    detail: [item.line_type && item.line_type !== 'product' ? LINE_LABELS[item.line_type] : undefined, item.sku].filter(Boolean).join(' · '),
    qty: item.quantity,
    unitPrice: item.unit_price,
    total: item.total,
    isFree: item.line_type === 'complimentary',
  }))

  const goTo = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col sm:max-w-lg overflow-hidden p-0"
      >
        {/* ── Header: number, status, key facts on one line ── */}
        <SheetHeader className="flex-shrink-0 space-y-1 border-b px-5 pb-4 pt-5">
          <SheetTitle className="pr-20 text-base font-semibold text-foreground">
            {order?.order_number ?? '…'}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {order && <SalesOrderStatusBadge status={order.status} />}
              {order?.patient_name && <span className="font-medium text-foreground">{order.patient_name}</span>}
              {order && <span>· {formatDate(orderDate || order.created_at)}</span>}
            </div>
          </SheetDescription>
        </SheetHeader>
        <DrawerLoadingBar active={isSwitching} />

        {/* ── Scrollable body ─────────────────────── */}
        <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
          {!order ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RiLoader4Line className="size-4 animate-spin" />
              Loading order…
            </div>
          ) : (
            <>
              <div className="space-y-4 border-b px-5 py-4">
                <SalesOrderStepper status={order.status} />
                <MoneyStrip
                  total={total}
                  paid={paid}
                  balance={balance}
                  onRecordPayment={orderInvoice && orderInvoice.balance_due > 0 ? () => setPaymentOpen(true) : undefined}
                  note={
                    !orderInvoice
                      ? 'No invoice yet'
                      : deliveryBlocked
                        ? 'Collect the balance before delivery'
                        : order.date_of_full_payment && balance > 0
                          ? `Due by ${formatDate(order.date_of_full_payment)}`
                          : undefined
                  }
                />
                <DrawerViewSwitch
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'details', label: 'Details' },
                    { value: 'invoice', label: 'Invoice', disabled: !orderInvoice },
                  ]}
                />
              </div>

              {view === 'invoice' && orderInvoice ? (
                <div className="space-y-2 px-5 py-4">
                  <InvoicePreview data={invoiceToPreviewData(orderInvoice)} company={companyProfile} />
                  <InvoicePreviewStatus data={invoiceToPreviewData(orderInvoice)} />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <DrawerSection icon={RiBox3Line} title={`Items (${lineItems.length})`}>
                    <LineItemList items={lineItems} />
                    <TotalsBlock subtotal={order.subtotal} discount={discount} total={order.total_amount} />
                  </DrawerSection>

                  <DrawerSection icon={RiUserLine} title="Patient & order">
                    <DrawerRow label="Patient" value={order.patient_name || order.patient_id} />
                    {testedByName && <DrawerRow label="Tested by" value={testedByName} />}
                    {order.sale_location && <DrawerRow label="Sold at" value={order.sale_location === 'institute' ? 'Institute' : 'Clinic'} />}
                    <DrawerRow label="Ordered" value={formatDate(orderDate || order.created_at)} />
                    {order.expected_delivery_date && <DrawerRow label="Ready by" value={formatDate(order.expected_delivery_date)} />}
                    {order.date_of_full_payment && <DrawerRow label="Payment due" value={formatDate(order.date_of_full_payment)} />}
                  </DrawerSection>

                  {order.prescription_id && (
                    <DrawerSection icon={RiEyeLine} title="Prescription">
                      {isLoadingRx ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                          <RiLoader4Line className="size-3.5 animate-spin" />
                          Loading…
                        </div>
                      ) : prescription ? (
                        <PrescriptionCard prescription={prescription} />
                      ) : (
                        <DrawerRow label="Prescription" value={order.prescription_id} mono />
                      )}
                    </DrawerSection>
                  )}

                  {order.notes && (
                    <DrawerSection icon={RiStickyNoteLine} title="Notes">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{order.notes}</p>
                    </DrawerSection>
                  )}

                  {/* History stays tucked away until it's needed */}
                  <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      <span className="flex items-center gap-1.5">
                        <RiHistoryLine className="size-3.5" />
                        History{auditLogs.length ? ` (${auditLogs.length + (order.status_history?.length ?? 0)})` : ''}
                      </span>
                      <RiArrowDownSLine className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 px-5 pb-4">
                      <SalesOrderTimeline
                        history={order.status_history ?? []}
                        createdAt={order.created_at}
                        createdBy={order.created_by}
                      />
                      {auditLogs.length > 0 && <AuditTrail logs={auditLogs} />}
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
            {nextAction && Icon && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* wrapper div so tooltip still fires on disabled button */}
                    <div className={deliveryBlocked ? 'cursor-not-allowed' : undefined}>
                      <Button
                        className={cn('w-full gap-2 font-semibold', nextAction.className)}
                        onClick={handleAdvance}
                        disabled={isPending || deliveryBlocked}
                      >
                        {isPending ? <RiLoader4Line className="size-4 animate-spin" /> : <Icon className="size-4" />}
                        {nextAction.label}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {deliveryBlocked && orderInvoice && (
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      Record the outstanding payment of {formatCurrency(orderInvoice.balance_due)} before completing delivery
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={handleDownloadPDF} disabled={downloading}>
                {downloading ? <RiLoader4Line className="size-4 animate-spin" /> : <RiDownloadLine className="size-4" />}
                PDF
              </Button>
              {order.invoice_id && (
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => goTo(`/invoices?detail=${order.invoice_id}`)}>
                  <RiReceiptLine className="size-4" />
                  Invoice
                </Button>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5" aria-label="More actions">
                    <RiMore2Line className="size-4" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      if (order.status === 'draft') goTo(`/sales-orders/assistant?draft=${order.order_id}`)
                      else setEditConfirmOpen(true)
                    }}
                  >
                    <RiFileEditLine className="size-4" />
                    Edit order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => goTo(`/sales-orders/assistant?reorder=${order.order_id}`)}>
                    <RiRefreshLine className="size-4" />
                    Reorder
                  </DropdownMenuItem>
                  {order.status === 'draft' && !order.invoice_id && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                      <RiDeleteBin6Line className="size-4" />
                      Delete draft
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Edit confirmation (non-draft orders) */}
    <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit this sales order?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{order?.order_number}</strong> has already been processed (status:{' '}
            <strong>{order?.status?.replace(/_/g, ' ')}</strong>). Editing it may affect linked
            inventory, prescriptions, or invoices. Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setEditConfirmOpen(false)
              onOpenChange(false)
              navigate(`/sales-orders/assistant?draft=${order?.order_id}`)
            }}
          >
            Edit Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Delete draft confirmation */}
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete draft order?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove draft <strong>{order?.order_number}</strong> and all its
            unsaved progress. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => order && deleteMutation.mutate(order.order_id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Draft'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Payment dialog */}
    {order && invoice && (
      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sales-order', order.order_id] })
          queryClient.invalidateQueries({ queryKey: ['invoice', order.invoice_id] })
        }}
        referenceType="INVOICE"
        referenceId={invoice.invoice_id}
        totalAmount={invoice.total_amount}
        paidAmount={invoice.paid_amount}
        patientName={invoice.patient_name}
        invoiceNumber={invoice.invoice_number}
        invoice={invoice}
        invalidateKeys={[['sales-orders'], ['sales-order', order.order_id]]}
      />
    )}
    </>
  )
}

// ── Prescription card ──────────────────────────────────────────────────────────

function PrescriptionCard({ prescription }: { prescription: Prescription }) {
  const rx = prescription.eye_prescription
  const hasEyeRx = !!rx

  return (
    <div className="space-y-3">
      {/* Meta row */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Row label="Date" value={formatDate(prescription.prescription_date)} />
        <Row label="Valid until" value={formatDate(prescription.valid_until)} />
        {prescription.doctor_name && (
          <Row label="Doctor" value={prescription.doctor_name} />
        )}
        {rx?.prescription_type && (
          <Row label="Type" value={rx.prescription_type.replace(/-/g, ' ')} />
        )}
      </div>

      {/* Eye chart — R / L */}
      {hasEyeRx && (
        <div className="rounded-lg border border-border/70 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="py-1.5 px-2 text-left font-semibold text-muted-foreground w-8">Eye</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground">SPH</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground">CYL</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground">AXIS</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground">ADD</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground">PD</th>
              </tr>
            </thead>
            <tbody>
              <EyeRow label="R" eye={rx.right_eye} />
              <EyeRow label="L" eye={rx.left_eye} isLast />
            </tbody>
          </table>
        </div>
      )}

      {prescription.diagnosis && (
        <div className="text-xs">
          <span className="text-muted-foreground font-medium">Diagnosis: </span>
          <span className="text-foreground">{prescription.diagnosis}</span>
        </div>
      )}

      {prescription.notes && (
        <div className="text-xs text-muted-foreground/80 italic leading-relaxed">
          {prescription.notes}
        </div>
      )}
    </div>
  )
}

function EyeRow({
  label,
  eye,
  isLast,
}: {
  label: string
  eye: Prescription['eye_prescription'] extends undefined ? never : NonNullable<Prescription['eye_prescription']>['right_eye']
  isLast?: boolean
}) {
  const fmt = (v: number) => {
    if (v === 0) return '0.00'
    return (v > 0 ? '+' : '') + v.toFixed(2)
  }

  return (
    <tr className={cn('text-center', !isLast && 'border-b border-border/50')}>
      <td className="py-2 px-2 font-bold text-left text-foreground">{label}</td>
      <td className="py-2 px-2 tabular-nums">{fmt(Number(eye.sphere))}</td>
      <td className="py-2 px-2 tabular-nums">{fmt(Number(eye.cylinder))}</td>
      <td className="py-2 px-2 tabular-nums">{eye.axis}°</td>
      <td className="py-2 px-2 tabular-nums">{Number(eye.add) !== 0 ? fmt(Number(eye.add)) : '—'}</td>
      <td className="py-2 px-2 tabular-nums">{eye.pupillary_distance || '—'}</td>
    </tr>
  )
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

function AuditTrail({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const action = log.action.replace(/_/g, ' ').toLowerCase()
        return (
          <div key={log.log_id} className="flex items-start gap-2.5 text-xs">
            <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40 mt-1.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-foreground capitalize">{action}</span>
                {log.user_id && (
                  <span className="text-muted-foreground">by <span className="font-mono text-[10px]">{log.user_id}</span></span>
                )}
              </div>
              <p className="text-muted-foreground/70 mt-0.5">
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : new Date(log.created_at).toLocaleString()}
              </p>
              {log.new_value != null && typeof log.new_value === 'object' && (() => {
                const str = JSON.stringify(log.new_value as Record<string, unknown>)
                return (
                  <div className="mt-1 rounded border border-border/50 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground overflow-hidden">
                    {str.slice(0, 120)}{str.length > 120 ? '…' : ''}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className={cn('text-foreground text-right', mono && 'font-mono text-[11px]')}>
        {value}
      </span>
    </div>
  )
}
