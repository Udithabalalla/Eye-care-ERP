import { RiArrowRightSLine } from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'
import { InvoicePreviewData } from './InvoicePreview'

export interface OrderSummaryExtras {
  patientMeta?: string
  isExistingPatient: boolean
  prescription: { label: string; od?: string; os?: string } | null
  orderDate?: string
  readyDate?: string
  soldAt?: string
}

const money = (value: number) => formatCurrency(roundCurrency(value))

const Section = ({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit?: () => void
  children: React.ReactNode
}) => (
  <div className="px-2 py-2">
    <div className="mb-1 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {onEdit && (
        <button type="button" onClick={onEdit} className="flex items-center text-[11px] font-medium text-primary hover:underline">
          Edit <RiArrowRightSLine className="h-3 w-3" />
        </button>
      )}
    </div>
    {children}
  </div>
)

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm italic text-muted-foreground">{children}</p>
)

/** Running summary of the order, shown beside the wizard on wide screens. */
const OrderSummaryPanel = ({
  data,
  extras,
  goTo,
}: {
  data: InvoicePreviewData
  extras: OrderSummaryExtras
  /** Returns a handler for a step the user may jump back to, or undefined */
  goTo: (step: number) => (() => void) | undefined
}) => {
  const frame = data.lines.find((l) => l.type === 'Frame')
  const lens = data.lines.find((l) => l.type === 'Lens')
  const others = data.lines.filter((l) => l.type !== 'Frame' && l.type !== 'Lens')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Order summary</CardTitle>
        <p className="text-xs text-muted-foreground">Updates as you go — use Edit to change a section</p>
      </CardHeader>
      <Separator />
      <CardContent className="max-h-[calc(100vh-14rem)] divide-y divide-border overflow-y-auto px-3 py-1">
        <Section title="Patient" onEdit={goTo(0)}>
          {data.billTo.name ? (
            <>
              <p className="text-sm font-medium">{data.billTo.name}</p>
              <p className="text-xs text-muted-foreground">
                {[data.billTo.phone, extras.patientMeta].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-muted-foreground">{extras.isExistingPatient ? 'Returning patient' : 'New patient — registered on save'}</p>
            </>
          ) : (
            <Empty>Not entered yet</Empty>
          )}
        </Section>

        <Section title="Prescription" onEdit={goTo(1)}>
          {extras.prescription ? (
            <>
              <p className="text-sm font-medium">{extras.prescription.label}</p>
              {extras.prescription.od && <p className="font-mono text-[11px] text-muted-foreground">OD {extras.prescription.od}</p>}
              {extras.prescription.os && <p className="font-mono text-[11px] text-muted-foreground">OS {extras.prescription.os}</p>}
            </>
          ) : (
            <Empty>Not entered yet</Empty>
          )}
        </Section>

        <Section title="Frame & lens" onEdit={goTo(frame ? 2 : 3)}>
          {frame ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{frame.name}</p>
                {frame.detail && <p className="truncate text-xs text-muted-foreground">{frame.detail}</p>}
              </div>
              <span className="shrink-0 text-sm tabular-nums">{money(frame.total)}</span>
            </div>
          ) : (
            <Empty>No frame selected</Empty>
          )}
          {lens ? (
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{lens.name}</p>
                {lens.detail && <p className="truncate text-xs text-muted-foreground">{lens.detail}</p>}
              </div>
              <span className="shrink-0 text-sm tabular-nums">{money(lens.total)}</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No lens — frame only</p>
          )}
        </Section>

        <Section title="Extras" onEdit={goTo(4)}>
          {others.length ? (
            <ul className="space-y-1">
              {others.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {line.name}
                    {line.qty > 1 && <span className="text-muted-foreground"> × {line.qty}</span>}
                  </span>
                  <span className={`shrink-0 tabular-nums ${line.type === 'Free' ? 'text-emerald-600' : ''}`}>
                    {line.type === 'Free' ? 'Free' : money(line.total)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None</Empty>
          )}
        </Section>

        <Section title="Order details" onEdit={goTo(5)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">Ordered</dt>
            <dd className="text-right">{extras.orderDate ? formatDate(extras.orderDate, 'MMM d, yyyy') : '—'}</dd>
            <dt className="text-muted-foreground">Ready by</dt>
            <dd className="text-right">{extras.readyDate ? formatDate(extras.readyDate, 'MMM d, yyyy') : '—'}</dd>
            <dt className="text-muted-foreground">Tested by</dt>
            <dd className="truncate text-right">{data.testedBy || '—'}</dd>
            <dt className="text-muted-foreground">Sold at</dt>
            <dd className="text-right">{extras.soldAt || '—'}</dd>
          </dl>
        </Section>

        <div className="space-y-1.5 px-2 py-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="tabular-nums">− {money(data.discount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold tabular-nums">{money(data.total)}</span>
          </div>
          {!data.isHistorical && data.paid > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Paid now</span>
              <span className="tabular-nums">{money(data.paid)}</span>
            </div>
          )}
          {!data.isHistorical && (
            <div className="flex justify-between font-medium text-primary">
              <span>Balance</span>
              <span className="tabular-nums">{money(data.balance)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default OrderSummaryPanel
