import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatters'
import type { DashboardOverview } from '@/api/dashboard.api'

/*
 * Categorical slots 1–4 in fixed order (validated: adjacent CVD ΔE ≥ 8.4 light and dark,
 * normal-vision ΔE ≥ 19.8). Two light steps sit under 3:1 on white, so every segment
 * also has a labelled legend row with its amount and share.
 */
const SLOTS: Record<string, string> = {
  frame: 'bg-[#2a78d6] dark:bg-[#3987e5]',
  lens: 'bg-[#eb6834] dark:bg-[#d95926]',
  product: 'bg-[#1baf7a] dark:bg-[#199e70]',
  expense: 'bg-[#eda100] dark:bg-[#c98500]',
}
const KIND_LABELS: Record<string, string> = { frame: 'Frame', lens: 'Lens', product: 'Product', expense: 'Service' }

/** What sold this month: share by kind as one stacked bar, then the best sellers */
export function SalesMixCard({ mix, top }: { mix: DashboardOverview['sales_mix']; top: DashboardOverview['top_items'] }) {
  const total = mix.reduce((sum, m) => sum + m.amount, 0)
  const parts = mix.filter((m) => m.amount > 0)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">What’s selling this month</CardTitle>
        <CardDescription>{total ? `${formatCurrency(total)} across this month’s orders` : 'No orders yet this month'}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {total > 0 && (
          <>
            {/* Part-to-whole: one bar, 2px surface gaps between segments */}
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Sales by kind this month">
              {parts.map((m) => (
                <div
                  key={m.kind}
                  className={cn('h-full first:rounded-l-full last:rounded-r-full', SLOTS[m.kind])}
                  style={{ width: `${(m.amount / total) * 100}%` }}
                  title={`${m.label}: ${formatCurrency(m.amount)} (${Math.round((m.amount / total) * 100)}%)`}
                />
              ))}
            </div>
            <ul className="space-y-1.5 text-sm">
              {mix.map((m) => (
                <li key={m.kind} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('size-2.5 shrink-0 rounded-sm', SLOTS[m.kind])} aria-hidden />
                    <span className="truncate text-muted-foreground">{m.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatCurrency(m.amount)}
                    <span className="ml-1 text-xs text-muted-foreground">{total ? Math.round((m.amount / total) * 100) : 0}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {top.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Best sellers</p>
            <ol className="divide-y divide-border/70">
              {top.map((item, index) => (
                <li key={`${item.kind}-${item.name}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">{KIND_LABELS[item.kind] ?? item.kind} · {item.quantity} sold</span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
