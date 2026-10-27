import { EyeMeasurement, EyePrescription } from '@/types/prescription.types'
import { cn } from '@/lib/utils'
import { plain, signed } from './rxFormat'

function EyeRow({ label, eye, last, size }: { label: string; eye?: EyeMeasurement; last?: boolean; size: 'sm' | 'md' }) {
  const cell = size === 'md' ? 'px-3 py-2.5' : 'px-2 py-1.5'
  return (
    <tr className={last ? undefined : 'border-b border-border/50'}>
      <td className={cn(cell, 'text-left font-semibold text-foreground')}>{label}</td>
      <td className={cn(cell, 'tabular-nums')}>{eye ? signed(eye.sphere) : '—'}</td>
      <td className={cn(cell, 'tabular-nums')}>{eye ? signed(eye.cylinder) : '—'}</td>
      <td className={cn(cell, 'tabular-nums')}>{eye ? plain(eye.axis, '°') : '—'}</td>
      <td className={cn(cell, 'tabular-nums')}>{eye ? (Number(eye.add) ? signed(eye.add) : '—') : '—'}</td>
      <td className={cn(cell, 'tabular-nums')}>{eye ? plain(eye.pupillary_distance) : '—'}</td>
    </tr>
  )
}

/** Right / left eye measurements as the compact grid opticians read */
export function EyeRxTable({ rx, size = 'sm' }: { rx: EyePrescription; size?: 'sm' | 'md' }) {
  const head = size === 'md' ? 'px-3 py-2' : 'px-2 py-1.5'
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <table className={cn('w-full text-center', size === 'md' ? 'text-sm' : 'text-xs')}>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className={cn(head, 'w-10 text-left font-semibold')}>Eye</th>
            <th className={cn(head, 'font-semibold')}>SPH</th>
            <th className={cn(head, 'font-semibold')}>CYL</th>
            <th className={cn(head, 'font-semibold')}>AXIS</th>
            <th className={cn(head, 'font-semibold')}>ADD</th>
            <th className={cn(head, 'font-semibold')}>PD</th>
          </tr>
        </thead>
        <tbody>
          <EyeRow label="R" eye={rx.right_eye} size={size} />
          <EyeRow label="L" eye={rx.left_eye} size={size} last />
        </tbody>
      </table>
    </div>
  )
}
