import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkline } from '@/components/common/Sparkline'
import { SalesOrderSummary } from '@/types/erp.types'

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

/** Whole rupees: the strip is for a glance, the table has the cents */
const rupees = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(amount)

interface Figure {
  label: string
  amount: number
  caption: string
  trend: number[]
  trendLabel: string
  tone?: 'destructive'
}

/** The money figures above the Sales Orders table: what's owed, what's late, what came in, what's due */
export function SalesOrderKpiStrip({ summary }: { summary?: SalesOrderSummary }) {
  const figures: Figure[] | null = summary
    ? [
        {
          label: 'To collect',
          amount: summary.to_collect.amount,
          caption: summary.to_collect.orders
            ? `${plural(summary.to_collect.orders, 'order')} waiting for payment`
            : 'Every order is paid up',
          trend: summary.to_collect.trend,
          trendLabel: 'Balance owed, by order date, over the last 30 days',
        },
        {
          label: 'Overdue',
          amount: summary.overdue.amount,
          caption: summary.overdue.orders
            ? `${plural(summary.overdue.orders, 'order')} · oldest ${plural(summary.overdue.oldest_days, 'day')} late`
            : 'Nothing past its delivery date',
          trend: summary.overdue.trend,
          trendLabel: 'Value of late orders, by promised date, over the last 30 days',
          tone: summary.overdue.orders ? 'destructive' : undefined,
        },
        {
          label: 'Collected this month',
          amount: summary.collected.amount,
          caption: summary.collected.payments
            ? `${plural(summary.collected.payments, 'payment')} in ${format(new Date(), 'MMMM')}`
            : `No payments yet in ${format(new Date(), 'MMMM')}`,
          trend: summary.collected.trend,
          trendLabel: 'Money taken each day this month',
        },
        {
          label: `Due in the next ${summary.due_soon.days} days`,
          amount: summary.due_soon.amount,
          caption: summary.due_soon.orders
            ? `${plural(summary.due_soon.orders, 'order')} to have ready`
            : 'No deliveries promised',
          trend: summary.due_soon.trend,
          trendLabel: `Value of orders promised on each of the next ${summary.due_soon.days} days`,
        },
      ]
    : null

  return (
    <section
      aria-label="Order figures"
      className="grid shrink-0 grid-cols-2 border-b border-border xl:grid-cols-4 [&>*]:border-border [&>*:nth-child(odd)]:border-r xl:[&>*]:border-r xl:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b xl:[&>*:nth-child(-n+2)]:border-b-0"
    >
      {figures
        ? figures.map((figure) => (
            <div key={figure.label} className="min-w-0 px-4 py-3 md:px-5">
              <p className="truncate text-sm text-muted-foreground">{figure.label}</p>
              {/* The trend sits beside the figure; the caption runs the full width under both */}
              <div className="flex items-end justify-between gap-3">
                <p className={cn('truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground', figure.tone === 'destructive' && 'text-destructive')}>
                  {rupees(figure.amount)}
                </p>
                <Sparkline
                  values={figure.trend}
                  label={figure.trendLabel}
                  className="mb-1 hidden w-20 shrink-0 sm:block"
                  dotClassName={figure.tone === 'destructive' ? 'text-destructive' : 'text-primary'}
                />
              </div>
              <p className="text-sm text-muted-foreground sm:truncate" title={figure.caption}>{figure.caption}</p>
            </div>
          ))
        : Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 px-4 py-3.5 md:px-5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
    </section>
  )
}
