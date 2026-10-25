import { cn } from '@/lib/utils'
import { daysOverdue, type PayableStatus } from '@/utils/supplierInvoice'

const TONES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  partial: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  unpaid: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
  overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
}

export function SupplierInvoiceStatusBadge({ invoice, className }: { invoice: PayableStatus; className?: string }) {
  const overdue = daysOverdue(invoice) > 0
  const [label, tone] = invoice.status === 'Paid'
    ? ['Paid', TONES.paid]
    : overdue
      ? ['Overdue', TONES.overdue]
      : invoice.status === 'Partial'
        ? ['Part paid', TONES.partial]
        : ['Unpaid', TONES.unpaid]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', tone, className)}>
      {label}
    </span>
  )
}
