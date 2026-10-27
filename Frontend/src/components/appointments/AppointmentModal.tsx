import Modal from '@/components/common/Modal'
import AppointmentForm from './AppointmentForm'
import { Appointment } from '@/types/appointment.types'
import { AppointmentType } from '@/types/common.types'

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  appointment?: Appointment | null
  initialPatientId?: string
  /** "yyyy-MM-dd" to start on */
  initialDate?: string
  initialDoctorId?: string
  initialType?: AppointmentType
  onSuccess: () => void
}

const AppointmentModal = ({ isOpen, onClose, appointment, initialPatientId, initialDate, initialDoctorId, initialType, onSuccess }: AppointmentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointment ? 'Reschedule appointment' : 'Book an appointment'}
      size="lg"
    >
      {/* Remount per opening so every booking starts clean */}
      {isOpen && (
        <AppointmentForm
          key={appointment?.appointment_id ?? `new-${initialPatientId ?? ''}-${initialDate ?? ''}-${initialDoctorId ?? ''}`}
          appointment={appointment}
          initialPatientId={initialPatientId}
          initialDate={initialDate}
          initialDoctorId={initialDoctorId}
          initialType={initialType}
          onSuccess={() => {
            onSuccess()
            onClose()
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}

export default AppointmentModal
