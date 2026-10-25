import { cn } from '@/lib/utils'

// Soft tints that read in both themes; a patient always gets the same one
const TINTS = [
  'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
]

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/**
 * Initials drawn locally. (The old avatars came from an outside service, which
 * meant sending every patient's name to a third party.)
 */
export function PatientAvatar({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  const key = seed || name
  const tint = TINTS[[...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length]
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', tint, className)}
    >
      {initials(name)}
    </span>
  )
}
