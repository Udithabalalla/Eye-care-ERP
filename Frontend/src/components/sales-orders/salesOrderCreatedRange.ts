import { subDays, startOfMonth } from 'date-fns'
import { localDateString } from '@/utils/formatters'

export type CreatedFilter = 'any' | 'today' | 'week' | 'month'
export type InvoiceFilter = 'any' | 'yes' | 'no'

export const CREATED_LABELS: Record<CreatedFilter, string> = {
  any: 'Any time',
  today: 'Today',
  week: 'Last 7 days',
  month: 'This month',
}

/** The created-date filter as the list's created_from / created_to (shop days) */
export const createdRange = (filter: CreatedFilter): { created_from?: string; created_to?: string } => {
  const today = new Date()
  if (filter === 'today') return { created_from: localDateString(today), created_to: localDateString(today) }
  if (filter === 'week') return { created_from: localDateString(subDays(today, 6)), created_to: localDateString(today) }
  if (filter === 'month') return { created_from: localDateString(startOfMonth(today)), created_to: localDateString(today) }
  return {}
}
