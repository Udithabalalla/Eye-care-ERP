import { EyeMeasurement, Prescription } from '@/types/prescription.types'

type Value = number | '' | null | undefined

const isBlank = (value: Value) => value === '' || value === null || value === undefined || Number.isNaN(Number(value))

/** Diopters the way opticians write them: +1.25, -0.50, 0.00 */
export const signed = (value: Value) => {
  if (isBlank(value)) return '—'
  const n = Number(value)
  if (n === 0) return '0.00'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

export const plain = (value: Value, suffix = '') => (isBlank(value) || Number(value) === 0 ? '—' : `${value}${suffix}`)

/** One eye on one line, e.g. "-2.50 / -0.75 × 180 add +1.50" */
export const eyeSummary = (eye?: EyeMeasurement) => {
  if (!eye || isBlank(eye.sphere)) return '—'
  let text = signed(eye.sphere)
  if (!isBlank(eye.cylinder) && Number(eye.cylinder) !== 0) text += ` / ${signed(eye.cylinder)} × ${plain(eye.axis)}`
  if (!isBlank(eye.add) && Number(eye.add) !== 0) text += ` add ${signed(eye.add)}`
  return text
}

export const PRESCRIPTION_TYPES = [
  { value: 'single-vision', label: 'Single vision' },
  { value: 'bifocal', label: 'Bifocal' },
  { value: 'progressive', label: 'Progressive' },
] as const

export const prescriptionTypeLabel = (type?: string) =>
  PRESCRIPTION_TYPES.find((t) => t.value === type)?.label ?? type ?? ''

/** Whether the prescription can still be used to make glasses */
export function validityOf(rx: Pick<Prescription, 'valid_until'>) {
  const days = Math.ceil((new Date(rx.valid_until).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { label: 'Expired', tone: 'expired' as const }
  if (days === 0) return { label: 'Expires today', tone: 'soon' as const }
  if (days <= 30) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'soon' as const }
  return { label: 'Valid', tone: 'valid' as const }
}

export const VALIDITY_CLASS = {
  expired: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  valid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
}
