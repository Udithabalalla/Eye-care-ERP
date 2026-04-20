import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentsApi } from '@/api/appointments.api'
import { Plus, Calendar } from '@untitledui/icons'
import { Button, Select, SelectItem, TableCard } from '@/components/ui'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import Loading from '@/components/common/Loading'
import { Appointment } from '@/types/appointment.types'
import { Key } from 'react-aria-components'

const Appointments = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', statusFilter],
    queryFn: () => appointmentsApi.getAll({ page: 1, page_size: 50, status: statusFilter }),
  })

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedAppointment(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedAppointment(null)
  }

  const handleStatusFilterChange = (key: Key | null) => {
    setStatusFilter(key === 'all' ? '' : String(key || ''))
  }

  // Group appointments by date
  const groupedAppointments = data?.data.reduce((acc, apt) => {
    const date = apt.appointment_date.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(apt)
    return acc
  }, {} as Record<string, Appointment[]>)

  return (
    <div className="space-y-6">
      {/* Card Header with Untitled UI Structure */}
      <TableCard.Root>
        <TableCard.Header
          title="Appointments"
          badge={data?.data.length || 0}
          description="Manage and schedule appointments"
          contentTrailing={
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Select
                selectedKey={statusFilter || 'all'}
                onSelectionChange={handleStatusFilterChange}
                placeholder="Status"
                aria-label="Filter by status"
                className="w-full sm:w-40"
              >
                <SelectItem id="all">All Statuses</SelectItem>
                <SelectItem id="scheduled">Scheduled</SelectItem>
                <SelectItem id="confirmed">Confirmed</SelectItem>
                <SelectItem id="in-progress">In Progress</SelectItem>
                <SelectItem id="completed">Completed</SelectItem>
                <SelectItem id="cancelled">Cancelled</SelectItem>
              </Select>
              <Button onClick={handleAdd} iconLeading={Plus} size="sm">
                New Appointment
              </Button>
            </div>
          }
        />

        {/* Appointments List */}
        <div className="p-6">
          {isLoading ? (
            <Loading />
          ) : (
            <div className="space-y-6">
              {groupedAppointments &&
                Object.entries(groupedAppointments).map(([date, appointments]) => (
                  <div key={date}>
                    <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                      <Calendar className="w-5 h-5 mr-2" />
                      {new Date(date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {appointments.map((apt) => (
                        <AppointmentCard
                          key={apt.appointment_id}
                          appointment={apt}
                          onClick={() => handleEdit(apt)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {(!groupedAppointments || Object.keys(groupedAppointments).length === 0) && (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No appointments found</p>
                  <Button onClick={handleAdd} iconLeading={Plus}>
                    Schedule First Appointment
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </TableCard.Root>

      {/* Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        appointment={selectedAppointment}
        onSuccess={() => refetch()}
      />
    </div>
  )
}

export default Appointments

