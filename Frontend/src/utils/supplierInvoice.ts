import { differenceInCalendarDays, parseISO } from 'date-fns'
import { SupplierInvoice } from '@/types/supplier.types'

export type PayableStatus = Pick<SupplierInvoice, 'status'> & Partial<Pick<SupplierInvoice, 'due_date' | 'balance_due'>>

/** Days past the due date for a bill that's still owing (0 when it isn't overdue) */
export function daysOverdue(invoice: PayableStatus): number {
  if (invoice.status === 'Paid' || !invoice.due_date) return 0
  return Math.max(0, differenceInCalendarDays(new Date(), parseISO(invoice.due_date)))
}

/** Short "when is it due" line, e.g. "Due in 3 days", "4 days overdue" */
export function dueText(invoice: PayableStatus): string | undefined {
  if (invoice.status === 'Paid') return 'Paid in full'
  if (!invoice.due_date) return undefined
  const days = differenceInCalendarDays(parseISO(invoice.due_date), new Date())
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}
