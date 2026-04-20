import { Table } from '@/components/ui'
import { formatDate } from '@/utils/formatters'
import type { Appointment } from '@/types/appointment.types'

interface SchedulingHistoryTableProps {
  appointments: Appointment[]
}

const SchedulingHistoryTable = ({ appointments }: SchedulingHistoryTableProps) => {
  if (!appointments.length) {
    return <p className="py-4 text-sm text-muted-foreground">No scheduling history found.</p>
  }

  return (
    <Table aria-label="Scheduling history" size="sm">
      <Table.Header bordered={false}>
        <Table.Head label="Appointment ID" />
        <Table.Head label="Date of Appointment" />
        <Table.Head label="Doctor" />
        <Table.Head label="Notes" />
      </Table.Header>
      <Table.Body items={appointments}>
        {(appointment) => (
          <Table.Row id={appointment.appointment_id}>
            <Table.Cell>
              <span className="font-medium text-brand-secondary">{appointment.appointment_id}</span>
            </Table.Cell>
            <Table.Cell>{formatDate(appointment.appointment_date, 'dd/MM/yyyy')}</Table.Cell>
            <Table.Cell className="max-w-[180px] truncate">{appointment.doctor_name}</Table.Cell>
            <Table.Cell className="max-w-[340px] truncate">{appointment.notes || appointment.reason || '-'}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  )
}

export default SchedulingHistoryTable
