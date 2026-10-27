import { format } from 'date-fns'
import { AppointmentStatus, AppointmentType } from '@/types/common.types'
import type { Appointment } from '@/types/appointment.types'
import type { Doctor } from '@/types/doctor.types'

// ── Labels people at the front desk actually use ────────────────────────────

export const STATUS_META: Record<AppointmentStatus, { label: string; className: string; dot: string }> = {
  [AppointmentStatus.SCHEDULED]: {
    label: 'Booked',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  [AppointmentStatus.CONFIRMED]: {
    label: 'Confirmed',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  [AppointmentStatus.IN_PROGRESS]: {
    label: 'Checked in',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  [AppointmentStatus.COMPLETED]: {
    label: 'Completed',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  [AppointmentStatus.CANCELLED]: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/50',
  },
  [AppointmentStatus.NO_SHOW]: {
    label: 'No-show',
    className: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
    dot: 'bg-red-500',
  },
}

export const VISIT_TYPES: { value: AppointmentType; label: string; minutes: number }[] = [
  { value: AppointmentType.CONSULTATION, label: 'Consultation', minutes: 30 },
  { value: AppointmentType.FOLLOW_UP, label: 'Follow-up', minutes: 15 },
  { value: AppointmentType.SCREENING, label: 'Eye screening', minutes: 30 },
  { value: AppointmentType.EMERGENCY, label: 'Urgent', minutes: 30 },
]

export const visitTypeLabel = (type: AppointmentType | string) =>
  VISIT_TYPES.find((t) => t.value === type)?.label ?? String(type)

/** Common reasons, so the front desk rarely has to type */
export const QUICK_REASONS = [
  'Eye test',
  'New glasses',
  'Contact lens fitting',
  'Follow-up check',
  'Blurred vision',
  'Red or painful eye',
]

/** Appointments that still take up the doctor's time */
export const isActiveBooking = (apt: Appointment) =>
  apt.status !== AppointmentStatus.CANCELLED && apt.status !== AppointmentStatus.NO_SHOW

const plainName = (name: string) => name.trim().toLowerCase().replace(/^dr\.?\s+/, '')

/**
 * Booked with this doctor. Older bookings may point at the doctor's staff login rather
 * than their profile, so a matching name counts too.
 */
export const isWithDoctor = (apt: Appointment, doctor: { id: string; name?: string }) =>
  apt.doctor_id === doctor.id || (!!doctor.name && plainName(apt.doctor_name) === plainName(doctor.name))

// ── Dates and times ─────────────────────────────────────────────────────────

/** "yyyy-MM-dd" of the appointment day (stored as midnight UTC) */
export const dayKeyOf = (apt: Pick<Appointment, 'appointment_date'>) => apt.appointment_date.split('T')[0]

/** "HH:mm" exactly as booked (times are stored as wall-clock values) */
export const timeOf = (apt: Pick<Appointment, 'appointment_time'>) => {
  const raw = apt.appointment_time.includes('T') ? apt.appointment_time.split('T')[1] : apt.appointment_time
  return raw.substring(0, 5)
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const endTimeOf = (start: string, duration: number) => fromMinutes(toMinutes(start) + duration)

export const todayKey = () => format(new Date(), 'yyyy-MM-dd')

/** Local calendar date for a "yyyy-MM-dd" key (avoids the UTC shift of new Date(key)) */
export const dateFromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// ── Doctor schedules and free slots ─────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The working week as doctor schedules list it, Monday first */
export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const worksOn = (doctor: Doctor | undefined, dayKey: string) => {
  if (!doctor?.available_days?.length) return true
  const dayName = DAY_NAMES[dateFromKey(dayKey).getDay()]
  return doctor.available_days.some((d) => d.toLowerCase() === dayName.toLowerCase())
}

export const dayName = (dayKey: string) => DAY_NAMES[dateFromKey(dayKey).getDay()]

/** Working hours, falling back to a normal clinic day when no profile exists */
export const hoursOf = (doctor?: Doctor) => ({
  start: doctor?.available_time_start || '09:00',
  end: doctor?.available_time_end || '17:00',
})

export interface Slot {
  time: string
  /** Who already has this time, if anyone */
  takenBy?: string
  past: boolean
}

/** Start times every 15 minutes in which a visit of `duration` fits without overlapping */
export function buildSlots(opts: {
  start: string
  end: string
  duration: number
  dayKey: string
  booked: Appointment[]
  ignoreId?: string
}): Slot[] {
  const { start, end, duration, dayKey, booked, ignoreId } = opts
  const step = 15
  const now = new Date()
  const isToday = dayKey === todayKey()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const busy = booked
    .filter((apt) => apt.appointment_id !== ignoreId && isActiveBooking(apt))
    .map((apt) => ({ from: toMinutes(timeOf(apt)), to: toMinutes(timeOf(apt)) + apt.duration_minutes, who: apt.patient_name }))

  const slots: Slot[] = []
  for (let t = toMinutes(start); t + duration <= toMinutes(end); t += step) {
    const clash = busy.find((b) => t < b.to && t + duration > b.from)
    slots.push({ time: fromMinutes(t), takenBy: clash?.who, past: isToday && t < nowMinutes })
  }
  return slots
}

/** Short working-days summary such as "Mon–Fri" or "Mon, Wed, Sat" */
export function summarizeDays(days: string[] = []) {
  const order = WEEK
  const idx = order
    .map((d, i) => (days.some((x) => x.toLowerCase() === d.toLowerCase()) ? i : -1))
    .filter((i) => i >= 0)
  if (idx.length === 0) return 'No days set'
  if (idx.length === 7) return 'Every day'
  const isRun = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (isRun && idx.length > 2) return `${order[idx[0]].slice(0, 3)}–${order[idx[idx.length - 1]].slice(0, 3)}`
  return idx.map((i) => order[i].slice(0, 3)).join(', ')
}
