import { EyeMeasurement, EyePrescription } from '@/types/prescription.types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { plain, signed } from './rxFormat'

function EyeRow({ label, eye, last, size }: { label: string; eye?: EyeMeasurement; last?: boolean; size: 'sm' | 'md' }) {
  const cell = size === 'md' ? 'px-3 py-2.5' : 'px-2 py-1.5'
  return (
    <TableRow className={cn('hover:bg-transparent', last ? 'border-0' : 'border-border/50')}>
      <TableCell className={cn(cell, 'text-left font-semibold text-foreground')}>{label}</TableCell>
      <TableCell className={cn(cell, 'tabular-nums')}>{eye ? signed(eye.sphere) : '—'}</TableCell>
      <TableCell className={cn(cell, 'tabular-nums')}>{eye ? signed(eye.cylinder) : '—'}</TableCell>
      <TableCell className={cn(cell, 'tabular-nums')}>{eye ? plain(eye.axis, '°') : '—'}</TableCell>
      <TableCell className={cn(cell, 'tabular-nums')}>{eye ? (Number(eye.add) ? signed(eye.add) : '—') : '—'}</TableCell>
      <TableCell className={cn(cell, 'tabular-nums')}>{eye ? plain(eye.pupillary_distance) : '—'}</TableCell>
    </TableRow>
  )
}

/** Right / left eye measurements as the compact grid opticians read */
export function EyeRxTable({ rx, size = 'sm' }: { rx: EyePrescription; size?: 'sm' | 'md' }) {
  const head = cn('h-auto font-semibold text-muted-foreground', size === 'md' ? 'px-3 py-2' : 'px-2 py-1.5')
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <Table className={cn('text-center', size === 'md' ? 'text-sm' : 'text-xs')}>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(head, 'w-10 text-left')}>Eye</TableHead>
            <TableHead className={cn(head, 'text-center')}>SPH</TableHead>
            <TableHead className={cn(head, 'text-center')}>CYL</TableHead>
            <TableHead className={cn(head, 'text-center')}>AXIS</TableHead>
            <TableHead className={cn(head, 'text-center')}>ADD</TableHead>
            <TableHead className={cn(head, 'text-center')}>PD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <EyeRow label="R" eye={rx.right_eye} size={size} />
          <EyeRow label="L" eye={rx.left_eye} size={size} last />
        </TableBody>
      </Table>
    </div>
  )
}
