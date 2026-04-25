import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/utils/formatters'
import type { Appointment } from '@/types/appointment.types'

interface SchedulingHistoryTableProps {
  appointments: Appointment[]
}

const SchedulingHistoryTable = ({ appointments }: SchedulingHistoryTableProps) => {
  if (!appointments.length) {
    return <p className="py-4 px-4 text-sm text-muted-foreground">No scheduling history found.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Appointment ID</TableHead>
          <TableHead>Date of Appointment</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appointment) => (
          <TableRow key={appointment.appointment_id}>
            <TableCell>
              <span className="font-medium text-primary">{appointment.appointment_id}</span>
            </TableCell>
            <TableCell>{formatDate(appointment.appointment_date, 'dd/MM/yyyy')}</TableCell>
            <TableCell className="max-w-[180px] truncate">{appointment.doctor_name}</TableCell>
            <TableCell className="max-w-[340px] truncate">
              {appointment.notes || appointment.reason || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default SchedulingHistoryTable
