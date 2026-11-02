import {
  RiArrowRightSLine,
  RiCalendarLine,
  RiCheckboxCircleFill,
  RiEyeLine,
  RiGlassesLine,
  RiReceiptLine,
  RiUserLine,
} from '@remixicon/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'
import { InvoicePreviewData, InvoicePreviewLine } from './InvoicePreview'

export interface EyeMeasurement {
  sphere: number
  cylinder: number
  axis: number
  add: number
}

export interface OrderSummaryExtras {
  patientMeta?: string
  isExistingPatient: boolean
  prescription: { label: string; od?: EyeMeasurement; os?: EyeMeasurement } | null
  orderDate?: string
  readyDate?: string
  soldAt?: string
}

const money = (value: number) => formatCurrency(roundCurrency(value))
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('')

const Section = ({
  icon: Icon,
  title,
  complete,
  onEdit,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  /** Shows a tick once the step behind this section has what it needs */
  complete?: boolean
  onEdit?: () => void
  children: React.ReactNode
}) => (
  <section className="px-2 py-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
        {complete && <RiCheckboxCircleFill className="size-3.5 text-emerald-500" aria-label="done" />}
      </h3>
      {onEdit && (
        <button type="button" onClick={onEdit} className="flex items-center text-[11px] font-medium text-primary hover:underline">
          Edit <RiArrowRightSLine className="h-3 w-3" />
        </button>
      )}
    </div>
    {children}
  </section>
)

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm italic text-muted-foreground">{children}</p>
)

const LineItem = ({ line, kind }: { line: InvoicePreviewLine; kind?: string }) => {
  const detail = [kind, line.detail].filter(Boolean).join(' · ')
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {line.name}
          {line.qty > 1 && <span className="font-normal text-muted-foreground"> × {line.qty}</span>}
        </p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      {line.type === 'Free' ? (
        <Badge variant="secondary" className="mt-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Free</Badge>
      ) : (
        <span className="shrink-0 text-sm tabular-nums">{money(line.total)}</span>
      )}
    </div>
  )
}

const DetailRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={`truncate text-right ${value ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{value || '—'}</dd>
  </div>
)

const PrescriptionGrid = ({ od, os }: { od?: EyeMeasurement; os?: EyeMeasurement }) => (
  <div className="overflow-hidden rounded-md border border-border">
    <Table className="text-[11px] tabular-nums">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-7 px-2"><span className="sr-only">Eye</span></TableHead>
          {['SPH', 'CYL', 'AXIS', 'ADD'].map((label) => (
            <TableHead key={label} className="h-7 px-2 text-right text-[10px] text-muted-foreground">{label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {([['OD', 'Right eye', od], ['OS', 'Left eye', os]] as const).map(([eye, name, m]) => m && (
          <TableRow key={eye} className="hover:bg-transparent">
            <TableCell className="px-2 py-1.5 font-semibold" title={name}>{eye}</TableCell>
            <TableCell className="px-2 py-1.5 text-right">{signed(m.sphere)}</TableCell>
            <TableCell className="px-2 py-1.5 text-right">{signed(m.cylinder)}</TableCell>
            <TableCell className="px-2 py-1.5 text-right">{m.axis ? `${m.axis}°` : '—'}</TableCell>
            <TableCell className="px-2 py-1.5 text-right">{m.add ? signed(m.add) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
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
      <CardContent className="max-h-[calc(100vh-24rem)] divide-y divide-border overflow-y-auto px-3 py-0">
        <Section icon={RiUserLine} title="Patient" complete={!!data.billTo.name} onEdit={goTo(0)}>
          {data.billTo.name ? (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(data.billTo.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{data.billTo.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[data.billTo.phone, extras.patientMeta].filter(Boolean).join(' · ')}
                </p>
                {!extras.isExistingPatient && (
                  <p className="text-xs text-muted-foreground">Registered when the order is saved</p>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">{extras.isExistingPatient ? 'Returning' : 'New'}</Badge>
            </div>
          ) : (
            <Empty>Not entered yet</Empty>
          )}
        </Section>

        <Section icon={RiEyeLine} title="Prescription" complete={!!extras.prescription} onEdit={goTo(1)}>
          {extras.prescription ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{extras.prescription.label}</p>
              {(extras.prescription.od || extras.prescription.os) && (
                <PrescriptionGrid od={extras.prescription.od} os={extras.prescription.os} />
              )}
            </div>
          ) : (
            <Empty>Not entered yet</Empty>
          )}
        </Section>

        <Section icon={RiGlassesLine} title="Frame & lens" complete={!!frame} onEdit={goTo(frame ? 2 : 3)}>
          <div className="space-y-2">
            {frame ? <LineItem line={frame} kind="Frame" /> : <Empty>No frame selected</Empty>}
            {lens ? <LineItem line={lens} kind="Lens" /> : <p className="text-xs text-muted-foreground">No lens — frame only</p>}
          </div>
        </Section>

        <Section icon={RiReceiptLine} title="Extras" onEdit={goTo(4)}>
          {others.length ? (
            <div className="space-y-2">
              {others.map((line) => <LineItem key={line.key} line={line} />)}
            </div>
          ) : (
            <Empty>None</Empty>
          )}
        </Section>

        <Section icon={RiCalendarLine} title="Order details" complete={!!data.testedBy && !!extras.readyDate} onEdit={goTo(5)}>
          <dl className="space-y-1">
            <DetailRow label="Ordered" value={extras.orderDate ? formatDate(extras.orderDate, 'MMM d, yyyy') : undefined} />
            <DetailRow label="Ready by" value={extras.readyDate ? formatDate(extras.readyDate, 'EEE, MMM d, yyyy') : undefined} />
            <DetailRow label="Tested by" value={data.testedBy} />
            <DetailRow label="Sold at" value={extras.soldAt} />
          </dl>
        </Section>
      </CardContent>

      {/* Totals stay in view while the sections above scroll */}
      <div className="space-y-1.5 border-t border-border bg-muted/30 px-5 py-3 text-sm">
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
          <div className="-mx-2 flex justify-between rounded-md bg-primary/10 px-2 py-1.5 font-medium text-primary">
            <span>Balance</span>
            <span className="tabular-nums">{money(data.balance)}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default OrderSummaryPanel
