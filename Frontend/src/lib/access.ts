import { formatDistanceToNowStrict } from 'date-fns'

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'optometrist', label: 'Optometrist' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'staff', label: 'Staff' },
] as const

export type RoleValue = (typeof ROLE_OPTIONS)[number]['value']

export const roleLabel = (role?: string) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role ?? '—'

/** The API stores UTC; some older fields come back without a zone, so treat those as UTC too */
export const parseServerDate = (value?: string | null): Date | null => {
  if (!value) return null
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export const timeAgo = (value?: string | null, fallback = 'Never') => {
  const date = parseServerDate(value)
  if (!date) return fallback
  if (Date.now() - date.getTime() < 60_000) return 'Just now'
  return `${formatDistanceToNowStrict(date)} ago`
}

export const formatDateTime = (value?: string | null) =>
  parseServerDate(value)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? '—'

/** "Chrome on Windows" from a User-Agent string; good enough to tell devices apart */
export const describeDevice = (userAgent?: string | null): string => {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? ua.slice(0, 40)
}
