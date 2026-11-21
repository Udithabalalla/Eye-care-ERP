import { format, parseISO } from 'date-fns'

export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    return format(dateObj, formatStr)
  } catch (error) {
    return 'Invalid date'
  }
}

// Database IDs (24 hex characters, e.g. a service's charge type) mean nothing to a customer
const INTERNAL_ID = /^[0-9a-f]{24}$/i

/** A line's detail ("Frame · RB5154 · 6addb107…") without any database IDs in it */
export const withoutInternalIds = (detail?: string): string | undefined =>
  detail
    ?.split('·')
    .map((part) => part.trim())
    .filter((part) => part && !INTERNAL_ID.test(part))
    .join(' · ') || undefined

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount)
}

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`
}

export const truncate = (str: string, length: number = 50): string => {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// The API sends UTC timestamps without a zone ("2026-11-18T09:27:33.498000"); read as is,
// browsers take them as local time, 5½ hours early in Sri Lanka. Dates the backend stores as
// midnight ("2026-11-18T00:00:00") are calendar dates and are left alone.
const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/
const MIDNIGHT = /T00:00:00(\.0+)?$/

/** A server timestamp with its UTC marker added, so it parses to the right moment */
export const asUtcTimestamp = (value: string): string =>
  NAIVE_TIMESTAMP.test(value) && !MIDNIGHT.test(value) ? `${value}Z` : value

/** Mark every server timestamp in an API response as UTC (see asUtcTimestamp) */
export const markUtcTimestamps = <T>(data: T): T => {
  if (typeof data === 'string') return asUtcTimestamp(data) as T
  if (Array.isArray(data)) return data.map(markUtcTimestamps) as T
  if (data && typeof data === 'object' && Object.getPrototypeOf(data) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) out[key] = markUtcTimestamps(value)
    return out as T
  }
  return data
}

/** Today (or the given moment) as yyyy-MM-dd in the user's timezone. toISOString() gives
 *  the UTC date instead, which is still yesterday before 05:30 in Sri Lanka. */
export const localDateString = (date: Date = new Date()): string => format(date, 'yyyy-MM-dd')

/** A moment as a datetime-local input value (yyyy-MM-ddTHH:mm) in the user's timezone */
export const localDateTimeInputValue = (date: Date = new Date()): string => `${format(date, 'yyyy-MM-dd')}T${format(date, 'HH:mm')}`

export const safeDate = (date: string | undefined | null, fallback: string = localDateString()): string => {
  if (!date) return fallback
  // Calendar dates keep their day; timestamps become the local day they happened on
  const calendar = /^(\d{4}-\d{2}-\d{2})(T00:00:00(\.0+)?(Z|[+-]00:?00)?)?$/.exec(date)
  if (calendar) return calendar[1]
  const d = parseISO(date)
  return isNaN(d.getTime()) ? fallback : localDateString(d)
}
