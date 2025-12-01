import Modal from '@/components/common/Modal'
import AppointmentForm from './AppointmentForm'
import { Appointment } from '@/types/appointment.types'

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  appointment?: Appointment | null
  onSuccess: () => void
}

const AppointmentModal = ({ isOpen, onClose, appointment, onSuccess }: AppointmentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={appointment ? 'Edit Appointment' : 'Schedule New Appointment'}
      size="lg"
    >
      <AppointmentForm
        appointment={appointment}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default AppointmentModal
