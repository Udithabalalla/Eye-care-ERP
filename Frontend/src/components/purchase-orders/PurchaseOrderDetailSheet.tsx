import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from '@/api/suppliers.api'
import { PurchaseOrderStatus } from '@/types/supplier.types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  RiLoader4Line,
  RiTruckLine,
  RiFileTextLine,
  RiCalendarLine,
  RiStickyNoteLine,
  RiBox3Line,
  RiDownloadLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge'
import { PurchaseOrderStepper } from './PurchaseOrderStepper'
import { PurchaseOrderTimeline } from './PurchaseOrderTimeline'
import { getPONextAction } from './PurchaseOrderWorkflowActions'
import ReceiveGoodsDialog from './ReceiveGoodsDialog'
import CreateSupplierInvoiceDialog from '@/components/invoices/CreateSupplierInvoiceDialog'

interface Props {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PurchaseOrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => suppliersApi.getPurchaseOrder(orderId!),
    enabled: open && !!orderId,
    staleTime: 0,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
      suppliersApi.updatePurchaseOrderStatus(id, status),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
  })

  const nextAction = order ? getPONextAction(order.status) : null
  const Icon = nextAction?.icon ?? null
  const isPending = statusMutation.isPending

  const handleAdvance = () => {
    if (!nextAction || !order) return

    if (nextAction.requiresDialog) {
      if (nextAction.toStatus === 'Received') setIsReceiveOpen(true)
      else if (nextAction.toStatus === 'Closed') setIsInvoiceOpen(true)
      return
    }

    toast.promise(
      suppliersApi.updatePurchaseOrderStatus(order.id, nextAction.toStatus).then((updated) => {
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] })
        return updated
      }),
      {
        loading: 'Updating status…',
        success: `Moved to "${nextAction.label}"`,
        error: (err: any) => err?.response?.data?.detail || 'Update failed',
      },
    )
  }

  const handleDownloadPdf = async () => {
    if (!order) return
    try {
      const blob = await suppliersApi.downloadPurchaseOrderPdf(order.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${order.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0"
        >
          {/* Header */}
          <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
            <div className="flex items-start gap-3 pr-8">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold text-foreground">
                  {order?.id ?? '…'}
                </SheetTitle>
                <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  {order && <PurchaseOrderStatusBadge status={order.status} />}
                  <span className="text-muted-foreground/60">·</span>
                  <span>{order ? formatDate(order.created_at) : ''}</span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Lifecycle stepper */}
            <div className="px-6 py-5 border-b bg-muted/20">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RiLoader4Line className="size-3.5 animate-spin" />
                  Loading…
                </div>
              ) : order ? (
                <PurchaseOrderStepper status={order.status} />
              ) : null}
            </div>

            {order && (
              <div className="divide-y divide-border">
                {/* Supplier */}
                <Section icon={RiTruckLine} title="Supplier">
                  <Row
                    label="Supplier"
                    value={order.supplier_information?.supplier_name || order.supplier_id}
                  />
                  {order.supplier_information?.company_name && (
                    <Row label="Company" value={order.supplier_information.company_name} />
                  )}
                  {order.supplier_information?.contact_person && (
                    <Row label="Contact" value={order.supplier_information.contact_person} />
                  )}
                  {order.supplier_information?.phone && (
                    <Row label="Phone" value={order.supplier_information.phone} />
                  )}
                  <Row label="Created by" value={order.created_by} />
                </Section>

                {/* Order Items */}
                <Section icon={RiBox3Line} title="Order Items">
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border/60">
                          <th className="py-1.5 px-1 text-left font-medium">Product</th>
                          <th className="py-1.5 px-1 text-center font-medium w-10">Qty</th>
                          <th className="py-1.5 px-1 text-right font-medium">Cost</th>
                          <th className="py-1.5 px-1 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0">
                            <td className="py-2 px-1">
                              <p className="font-medium text-foreground leading-tight font-mono text-[10px]">
                                {item.product_id}
                              </p>
                            </td>
                            <td className="py-2 px-1 text-center tabular-nums">{item.quantity}</td>
                            <td className="py-2 px-1 text-right tabular-nums">
                              {formatCurrency(item.unit_cost)}
                            </td>
                            <td className="py-2 px-1 text-right tabular-nums font-medium">
                              {formatCurrency(item.total_price ?? item.quantity * item.unit_cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  {order.order_summary && (
                    <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                      {(order.order_summary.discount ?? 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="tabular-nums">
                            − {formatCurrency(order.order_summary.discount ?? 0)}
                          </span>
                        </div>
                      )}
                      {(order.order_summary.tax_amount ?? 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Tax ({((order.order_summary.tax_rate ?? 0) * 100).toFixed(1)}%)
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(order.order_summary.tax_amount ?? 0)}
                          </span>
                        </div>
                      )}
                      {(order.order_summary.shipping_cost ?? 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Shipping</span>
                          <span className="tabular-nums">
                            {formatCurrency(order.order_summary.shipping_cost ?? 0)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold pt-1">
                        <span>Total</span>
                        <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
                      </div>
                    </div>
                  )}
                </Section>

                {/* Dates */}
                <Section icon={RiCalendarLine} title="Dates">
                  <Row label="Order date" value={formatDate(order.order_date)} />
                  {order.expected_delivery_date && (
                    <Row
                      label="Expected delivery"
                      value={formatDate(order.expected_delivery_date)}
                    />
                  )}
                </Section>

                {/* Payment Terms */}
                {order.payment_terms && (
                  <Section icon={RiFileTextLine} title="Payment Terms">
                    {order.payment_terms.payment_terms && (
                      <Row label="Terms" value={order.payment_terms.payment_terms} />
                    )}
                    {order.payment_terms.payment_method && (
                      <Row label="Method" value={order.payment_terms.payment_method} />
                    )}
                    <Row label="Currency" value={order.payment_terms.currency ?? 'LKR'} />
                  </Section>
                )}

                {/* Notes */}
                {(order.notes?.supplier_notes || order.notes?.internal_notes) && (
                  <Section icon={RiStickyNoteLine} title="Notes">
                    {order.notes.supplier_notes && (
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground font-medium">Supplier notes</p>
                        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {order.notes.supplier_notes}
                        </p>
                      </div>
                    )}
                    {order.notes.internal_notes && (
                      <div className="text-xs space-y-0.5 mt-2">
                        <p className="text-muted-foreground font-medium">Internal notes</p>
                        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {order.notes.internal_notes}
                        </p>
                      </div>
                    )}
                  </Section>
                )}

                {/* Status History */}
                <Section icon={RiFileTextLine} title="Status History">
                  <PurchaseOrderTimeline
                    history={order.status_history ?? []}
                    createdAt={order.created_at}
                    createdBy={order.created_by}
                  />
                </Section>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex-shrink-0 border-t bg-background px-6 py-4 flex flex-col gap-2">
            {nextAction && Icon && (
              <Button
                className={cn('w-full gap-2 font-semibold', nextAction.className)}
                onClick={handleAdvance}
                disabled={isPending}
              >
                {isPending ? (
                  <RiLoader4Line className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                {nextAction.label}
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={handleDownloadPdf}
              disabled={!order}
            >
              <RiDownloadLine className="size-4" />
              Download PDF
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs triggered from sheet */}
      {order && (
        <>
          <ReceiveGoodsDialog
            isOpen={isReceiveOpen}
            order={order}
            onClose={() => setIsReceiveOpen(false)}
            onSuccess={() => {
              setIsReceiveOpen(false)
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
              queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] })
              setIsInvoiceOpen(true)
            }}
          />
          <CreateSupplierInvoiceDialog
            isOpen={isInvoiceOpen}
            order={order}
            onClose={() => setIsInvoiceOpen(false)}
            onSuccess={() => {
              setIsInvoiceOpen(false)
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
              queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] })
            }}
          />
        </>
      )}
    </>
  )
}

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
