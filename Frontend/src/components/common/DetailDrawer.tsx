import { RiMoneyDollarCircleLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatters'

/*
 * Building blocks shared by the record detail drawers (sales orders, invoices)
 * so they read the same way: header facts → money → flat sections → actions.
 */

/** Thin bar across the top of the drawer while the next record loads in place */
export function DrawerLoadingBar({ active }: { active: boolean }) {
  return (
    <div className="h-0.5 w-full overflow-hidden" aria-hidden>
      {active && <div className="h-full w-full animate-pulse bg-primary/70" />}
    </div>
  )
}

/** Segmented switch between the drawer's views, e.g. Details / Invoice */
export function DrawerViewSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; disabled?: boolean }>
}) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40',
            value === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Total · Paid · Balance at a glance, with the payment action next to the balance */
export function MoneyStrip({
  total,
  paid,
  balance,
  onRecordPayment,
  note,
  actionLabel = 'Record payment',
}: {
  total: number
  paid: number
  balance: number
  onRecordPayment?: () => void
  /** Short line under the numbers — text, or a link to the related record */
  note?: React.ReactNode
  actionLabel?: string
}) {
  const settled = total > 0 && balance <= 0
  return (
    <div className="rounded-xl border border-border">
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-sm font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Paid</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(paid)}</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Balance</p>
          <p className={cn('text-sm font-semibold tabular-nums', settled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            {settled ? 'Paid' : formatCurrency(balance)}
          </p>
        </div>
      </div>
      {(onRecordPayment || note) && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          <div className="min-w-0 text-xs text-muted-foreground">{note}</div>
          {onRecordPayment && balance > 0 && (
            <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={onRecordPayment}>
              <RiMoneyDollarCircleLine className="size-4" />
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Flat section with a small heading; sections are separated by the drawer's dividers */
export function DrawerSection({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('px-5 py-4', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {Icon && <Icon className="size-3.5" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Label / value pair */
export function DrawerRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 text-right text-foreground', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  )
}

export interface DrawerLineItem {
  key: string
  name: string
  detail?: string
  qty: number
  unitPrice: number
  total: number
  isFree?: boolean
  /** Short status after the detail, e.g. "3 of 4 received" */
  note?: string
  noteTone?: 'success' | 'warning'
}

/** Line items as a list rather than a wide table, so nothing is cut off at drawer width */
export function LineItemList({ items }: { items: DrawerLineItem[] }) {
  return (
    <ul className="divide-y divide-border/70">
      {items.map((item) => (
        <li key={item.key} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[item.detail, item.isFree ? 'Free' : `${item.qty} × ${formatCurrency(item.unitPrice)}`].filter(Boolean).join(' · ')}
            </p>
            {item.note && (
              <p className={cn('text-xs font-medium', item.noteTone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                {item.note}
              </p>
            )}
          </div>
          <span className={cn('shrink-0 text-sm font-medium tabular-nums', item.isFree && 'text-emerald-600 dark:text-emerald-400')}>
            {item.isFree ? 'Free' : formatCurrency(item.total)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Subtotal / discount / total block under the line items */
export function TotalsBlock({
  subtotal,
  discount,
  charges,
  total,
}: {
  subtotal: number
  discount?: number
  /** Extra lines between the discount and the total, e.g. shipping */
  charges?: Array<{ label: string; amount: number }>
  total: number
}) {
  return (
    <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatCurrency(subtotal)}</span>
      </div>
      {!!discount && discount > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="tabular-nums">− {formatCurrency(discount)}</span>
        </div>
      )}
      {charges?.filter((charge) => charge.amount > 0).map((charge) => (
        <div key={charge.label} className="flex justify-between text-muted-foreground">
          <span>{charge.label}</span>
          <span className="tabular-nums">{formatCurrency(charge.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
