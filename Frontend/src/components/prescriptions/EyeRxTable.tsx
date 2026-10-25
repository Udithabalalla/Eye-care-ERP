import { EyeMeasurement, EyePrescription } from '@/types/prescription.types'

const signed = (value: number | '') => {
  if (value === '' || value === null || value === undefined) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  if (n === 0) return '0.00'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

const plain = (value: number | '', suffix = '') => (value === '' || value === null || value === undefined || Number(value) === 0 ? '—' : `${value}${suffix}`)

function EyeRow({ label, eye, last }: { label: string; eye?: EyeMeasurement; last?: boolean }) {
  return (
    <tr className={last ? undefined : 'border-b border-border/50'}>
      <td className="px-2 py-1.5 text-left font-semibold text-foreground">{label}</td>
      <td className="px-2 py-1.5 tabular-nums">{eye ? signed(eye.sphere) : '—'}</td>
      <td className="px-2 py-1.5 tabular-nums">{eye ? signed(eye.cylinder) : '—'}</td>
      <td className="px-2 py-1.5 tabular-nums">{eye ? plain(eye.axis, '°') : '—'}</td>
      <td className="px-2 py-1.5 tabular-nums">{eye ? (Number(eye.add) ? signed(eye.add) : '—') : '—'}</td>
      <td className="px-2 py-1.5 tabular-nums">{eye ? plain(eye.pupillary_distance) : '—'}</td>
    </tr>
  )
}

/** Right / left eye measurements as the compact grid opticians read */
export function EyeRxTable({ rx }: { rx: EyePrescription }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <table className="w-full text-center text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-1.5 text-left font-semibold">Eye</th>
            <th className="px-2 py-1.5 font-semibold">SPH</th>
            <th className="px-2 py-1.5 font-semibold">CYL</th>
            <th className="px-2 py-1.5 font-semibold">AXIS</th>
            <th className="px-2 py-1.5 font-semibold">ADD</th>
            <th className="px-2 py-1.5 font-semibold">PD</th>
          </tr>
        </thead>
        <tbody>
          <EyeRow label="R" eye={rx.right_eye} />
          <EyeRow label="L" eye={rx.left_eye} last />
        </tbody>
      </table>
    </div>
  )
}
