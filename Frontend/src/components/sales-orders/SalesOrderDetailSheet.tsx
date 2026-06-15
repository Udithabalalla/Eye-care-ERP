import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { salesOrdersApi, auditLogsApi } from '@/api/erp.api'
import { invoicesApi } from '@/api/invoices.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
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
import { Badge } from '@/components/ui/badge'
import {
  RiFileEditLine,
  RiReceiptLine,
  RiLoader4Line,
  RiBox3Line,
  RiSettings4Line,
  RiShieldCheckLine,
  RiTruckLine,
  RiUserLine,
  RiCalendarLine,
  RiFileTextLine,
  RiStickyNoteLine,
  RiEyeLine,
  RiMoneyDollarCircleLine,
  RiRefreshLine,
  RiHistoryLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { SalesOrderStatusBadge } from './SalesOrderStatusBadge'
import { SalesOrderStepper } from './SalesOrderStepper'
import { SalesOrderTimeline } from './SalesOrderTimeline'
import { getNextAction } from './SalesOrderWorkflowActions'
import { RecordPaymentDialog } from '@/components/common/RecordPaymentDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lens_ordered: RiBox3Line,
  fitting: RiSettings4Line,
  ready: RiShieldCheckLine,
  delivered: RiTruckLine,
}

interface Props {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SalesOrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentOpen, setPaymentOpen] = useState(false)

  const { data: order } = useQuery({
    queryKey: ['sales-order', orderId],
    queryFn: () => salesOrdersApi.getById(orderId!),
    enabled: open && !!orderId,
    staleTime: 0,
  })

  const { data: prescription, isLoading: isLoadingRx } = useQuery({
    queryKey: ['prescription', order?.prescription_id],
    queryFn: () => prescriptionsApi.getById(order!.prescription_id!),
    enabled: open && !!order?.prescription_id,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch invoice when SO has one linked (to get live balance_due)
  const { data: invoice } = useQuery({
    queryKey: ['invoice', order?.invoice_id],
    queryFn: () => invoicesApi.getById(order!.invoice_id!),
    enabled: open && !!order?.invoice_id,
    staleTime: 0,
  })

  // Audit trail for this order
  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'sales-order', orderId],
    queryFn: () => auditLogsApi.getAll({ page: 1, page_size: 50, entity_type: 'sales_order', entity_id: orderId! }),
    enabled: open && !!orderId,
    staleTime: 30_000,
  })
  const auditLogs = auditData?.data ?? []

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
  const advancePayment = measurements?.advance_payment
  const orderType = measurements?.order_type as string | undefined
  const orderDate = measurements?.order_date as string | undefined

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
                {order?.order_number ?? '…'}
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                {order && <SalesOrderStatusBadge status={order.status} />}
                <span className="text-muted-foreground/60">·</span>
                <span>{order ? formatDate(order.created_at) : ''}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable body ─────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Lifecycle stepper */}
          <div className="px-6 py-5 border-b bg-muted/20">
            {order ? (
              <SalesOrderStepper status={order.status} />
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Loading…
              </div>
            )}
          </div>

          {order && <div className="divide-y divide-border">

            {/* Patient */}
            <Section icon={RiUserLine} title="Patient">
              <Row label="Name" value={order.patient_name || order.patient_id} />
              <Row label="Patient ID" value={order.patient_id} mono />
              {order.tested_by && <Row label="Tested by" value={order.tested_by} />}
            </Section>

            {/* Prescription — shown only when linked */}
            {order.prescription_id && (
              <Section icon={RiEyeLine} title="Prescription">
                {isLoadingRx ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <RiLoader4Line className="size-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : prescription ? (
                  <PrescriptionCard prescription={prescription} />
                ) : (
                  <Row label="Prescription ID" value={order.prescription_id} mono />
                )}
              </Section>
            )}

            {/* Order Items */}
            <Section icon={RiBox3Line} title="Order Items">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60">
                      <th className="py-1.5 px-1 text-left font-medium">Item</th>
                      <th className="py-1.5 px-1 text-center font-medium w-10">Qty</th>
                      <th className="py-1.5 px-1 text-right font-medium">Price</th>
                      <th className="py-1.5 px-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="py-2 px-1">
                          <p className="font-medium text-foreground leading-tight">
                            {item.product_name || item.product_id}
                          </p>
                          {item.sku && (
                            <p className="text-muted-foreground/70 font-mono text-[10px]">
                              {item.sku}
                            </p>
                          )}
                          {item.line_type && item.line_type !== 'product' && (
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {item.line_type}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-1 text-center tabular-nums">{item.quantity}</td>
                        <td className="py-2 px-1 text-right tabular-nums">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums font-medium">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium">{formatCurrency(order.subtotal)}</span>
                </div>
                {advancePayment != null && Number(advancePayment) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Advance paid</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      − {formatCurrency(Number(advancePayment))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold pt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </Section>

            {/* Dates */}
            <Section icon={RiCalendarLine} title="Dates">
              <Row
                label="Order date"
                value={orderDate ? formatDate(orderDate) : formatDate(order.created_at)}
              />
              {order.expected_delivery_date && (
                <Row label="Expected delivery" value={formatDate(order.expected_delivery_date)} />
              )}
              {order.date_of_full_payment && (
                <Row label="Full payment by" value={formatDate(order.date_of_full_payment)} />
              )}
            </Section>

            {/* Order details from measurements */}
            {(orderType ||
              measurements?.frame_total != null ||
              measurements?.lens_total != null) && (
              <Section icon={RiFileTextLine} title="Order Details">
                {orderType && (
                  <Row label="Order type" value={orderType.replace(/_/g, ' ')} />
                )}
                {measurements?.frame_total != null && (
                  <Row
                    label="Frame total"
                    value={formatCurrency(Number(measurements.frame_total))}
                  />
                )}
                {measurements?.lens_total != null && (
                  <Row
                    label="Lens total"
                    value={formatCurrency(Number(measurements.lens_total))}
                  />
                )}
                {measurements?.discount != null && Number(measurements.discount) > 0 && (
                  <Row
                    label="Discount"
                    value={`− ${formatCurrency(Number(measurements.discount))}`}
                  />
                )}
              </Section>
            )}

            {/* Notes */}
            {order.notes && (
              <Section icon={RiStickyNoteLine} title="Notes">
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {order.notes}
                </p>
              </Section>
            )}

            {/* Status history timeline */}
            <Section icon={RiFileTextLine} title="Status History">
              <SalesOrderTimeline
                history={order.status_history ?? []}
                createdAt={order.created_at}
                createdBy={order.created_by}
              />
            </Section>

            {/* Audit trail */}
            {auditLogs.length > 0 && (
              <Section icon={RiHistoryLine} title="Audit Trail">
                <AuditTrail logs={auditLogs} />
              </Section>
            )}
          </div>}
        </div>

        {/* ── Footer actions ─────────────────────── */}
        <div className="flex-shrink-0 border-t bg-background px-6 py-4 flex flex-col gap-2">
          {/* Payment prompt — shown when order is ready or delivered and has an invoice */}
          {order && ['ready', 'delivered'].includes(order.status) && (
            <div className={cn(
              'rounded-lg border p-3 flex items-center justify-between gap-3',
              invoice && invoice.balance_due > 0
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
            )}>
              <div>
                {invoice && invoice.balance_due > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Payment pending</p>
                    <p className="text-sm font-bold tabular-nums text-amber-900 dark:text-amber-100">
                      {formatCurrency(invoice.balance_due)} due
                    </p>
                  </>
                ) : invoice ? (
                  <>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Fully paid</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatCurrency(invoice.total_amount)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground">No invoice linked</p>
                    <p className="text-xs text-muted-foreground">Generate invoice to record payment</p>
                  </>
                )}
              </div>
              {invoice && invoice.balance_due > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shrink-0"
                  onClick={() => setPaymentOpen(true)}
                >
                  <RiMoneyDollarCircleLine className="size-3.5" />
                  Record Payment
                </Button>
              )}
              {invoice && invoice.balance_due <= 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">Paid</Badge>
              )}
            </div>
          )}

          {nextAction && Icon && (() => {
            // Block "Complete Delivery" if there is an unpaid invoice balance
            const blocked = nextAction.toStatus === 'delivered' && !!invoice && invoice.balance_due > 0
            const tooltipMsg = blocked
              ? `Record the outstanding payment of ${formatCurrency(invoice!.balance_due)} before completing delivery`
              : undefined

            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* wrapper div so tooltip still fires on disabled button */}
                    <div className={blocked ? 'cursor-not-allowed' : undefined}>
                      <Button
                        className={cn('w-full gap-2 font-semibold', nextAction.className)}
                        onClick={handleAdvance}
                        disabled={isPending || blocked}
                      >
                        {isPending ? (
                          <RiLoader4Line className="size-4 animate-spin" />
                        ) : (
                          <Icon className="size-4" />
                        )}
                        {nextAction.label}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {tooltipMsg && (
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      {tooltipMsg}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )
          })()}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => {
                onOpenChange(false)
                navigate(`/sales-orders/assistant?draft=${order?.order_id}`)
              }}
            >
              <RiFileEditLine className="size-4" />
              Edit Order
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => {
                onOpenChange(false)
                navigate(`/sales-orders/assistant?reorder=${order?.order_id}`)
              }}
            >
              <RiRefreshLine className="size-4" />
              Reorder
            </Button>
            {order?.invoice_id && (
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => {
                  onOpenChange(false)
                  navigate(`/invoices?detail=${order?.invoice_id}`)
                }}
              >
                <RiReceiptLine className="size-4" />
                Invoice
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>

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

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

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
