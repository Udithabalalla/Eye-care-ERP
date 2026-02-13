import { Calendar, Clock, User01 } from '@untitledui/icons'
import { Appointment } from '@/types/appointment.types'
import { formatDate } from '@/utils/formatters'
import { getStatusColor } from '@/utils/helpers'

interface AppointmentCardProps {
  appointment: Appointment
  onClick: () => void
}

const AppointmentCard = ({ appointment, onClick }: AppointmentCardProps) => {
  const timeStr = appointment.appointment_time.split('T')[1]?.substring(0, 5) || 'N/A'

  return (
    <div
      onClick={onClick}
      className="card hover:shadow-md transition-shadow cursor-pointer border-l-4"
      style={{
        borderLeftColor:
          appointment.status === 'scheduled'
            ? '#3b82f6'
            : appointment.status === 'confirmed'
            ? '#10b981'
            : '#6b7280',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-semibold text-primary">{appointment.patient_name}</h3>
            <span className={`badge ${getStatusColor(appointment.status)}`}>
              {appointment.status}
            </span>
          </div>

          <div className="space-y-1 text-sm text-secondary">
            <div className="flex items-center space-x-2">
              <User01 className="w-4 h-4" />
              <span>{appointment.doctor_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(appointment.appointment_date)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>
                {timeStr} ({appointment.duration_minutes} mins)
              </span>
            </div>
          </div>

          <p className="text-sm text-secondary mt-2">{appointment.reason}</p>
        </div>

        <div className="text-right">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-tertiary text-secondary rounded capitalize">
            {appointment.type}
          </span>
        </div>
      </div>
    </div>
  )
}

export default AppointmentCard
