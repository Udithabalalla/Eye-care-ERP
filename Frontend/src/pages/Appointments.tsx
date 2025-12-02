import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentsApi } from '@/api/appointments.api'
import { Plus, Calendar as CalendarIcon } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import Loading from '@/components/common/Loading'
import { Appointment } from '@/types/appointment.types'

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

  // Group appointments by date
  const groupedAppointments = data?.data.reduce((acc, apt) => {
    const date = apt.appointment_date.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(apt)
    return acc
  }, {} as Record<string, Appointment[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Appointments</h1>
          <p className="text-text-secondary mt-1">Manage and schedule appointments</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {groupedAppointments &&
            Object.entries(groupedAppointments).map(([date, appointments]) => (
              <div key={date}>
                <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2" />
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
            <div className="card text-center py-12">
              <CalendarIcon className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-secondary">No appointments found</p>
              <button onClick={handleAdd} className="btn-primary mt-4">
                Schedule First Appointment
              </button>
            </div>
          )}
        </div>
      )}

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
