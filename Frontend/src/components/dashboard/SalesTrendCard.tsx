import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatters'
import type { DashboardOverview } from '@/api/dashboard.api'

type Day = DashboardOverview['daily'][number] & { label: string; isToday: boolean; todayLabel: string | null }

// One series, one hue: the brand teal (validated at 3:1+ on the light and dark card surfaces)
const chartConfig = {
  sales: { label: 'Sales', color: 'var(--dash-accent)' },
} satisfies ChartConfig

const compact = (value: number) => (value >= 1000 ? `${Math.round(value / 100) / 10}K` : `${value}`)

function SalesTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Day }> }) {
  const day = active ? payload?.[0]?.payload : undefined
  if (!day) return null
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-muted-foreground">{format(parseISO(day.date), 'EEE dd MMM')}{day.isToday ? ' · today' : ''}</p>
      <div className="space-y-1">
        <p className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-0.5 w-3 rounded-full bg-[var(--dash-accent)]" aria-hidden />
            Sales
          </span>
          <span className="font-semibold tabular-nums text-foreground">{formatCurrency(day.sales)}</span>
        </p>
        <p className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>Collected</span>
          <span className="tabular-nums text-foreground">{formatCurrency(day.collected)}</span>
        </p>
        <p className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>Invoices</span>
          <span className="tabular-nums text-foreground">{day.invoices}</span>
        </p>
      </div>
    </div>
  )
}

/** Daily sales for the last 30 days, with a table view of the same numbers */
export function SalesTrendCard({ daily, today }: { daily: DashboardOverview['daily']; today: string }) {
  const [asTable, setAsTable] = useState(false)
  const days: Day[] = daily.map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'dd MMM'),
    isToday: d.date === today,
    todayLabel: d.date === today && d.sales > 0 ? compact(d.sales) : null,
  }))
  const total = days.reduce((sum, d) => sum + d.sales, 0)
  const collected = days.reduce((sum, d) => sum + d.collected, 0)
  const best = days.reduce((top, d) => (d.sales > (top?.sales ?? 0) ? d : top), undefined as Day | undefined)
  const empty = total === 0 && collected === 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Sales, last 30 days</CardTitle>
          <CardDescription>
            {empty ? 'No sales in the last 30 days yet' : `${formatCurrency(total)} invoiced · ${formatCurrency(collected)} collected`}
            {best && !empty ? ` · best day ${format(parseISO(best.date), 'dd MMM')}` : ''}
          </CardDescription>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5" role="tablist" aria-label="Chart or table">
          {(['Chart', 'Table'] as const).map((label) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={asTable === (label === 'Table')}
              onClick={() => setAsTable(label === 'Table')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                asTable === (label === 'Table') ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {asTable ? (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...days].reverse().map((d) => (
                  <TableRow key={d.date}>
                    <TableCell>{format(parseISO(d.date), 'EEE dd MMM')}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(d.sales)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(d.collected)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.invoices}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Height includes the axis band so nothing scrolls inside the card
          <ChartContainer config={chartConfig} className="fade-enter aspect-auto h-64 w-full">
            <BarChart data={days} margin={{ top: 20, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} strokeWidth={1} className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={4}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={compact} fontSize={11} allowDecimals={false} />
              <ChartTooltip cursor={{ className: 'fill-muted/60' }} content={<SalesTooltip />} />
              {/* Bars rise once the card has settled; Recharts skips this under "reduce motion" */}
              <Bar
                dataKey="sales"
                fill="var(--color-sales)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                animationBegin={150}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {/* Only today's column carries a value label; the axis and tooltip carry the rest */}
                <LabelList dataKey="todayLabel" position="top" offset={6} className="fill-foreground text-[10px] font-medium" />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
