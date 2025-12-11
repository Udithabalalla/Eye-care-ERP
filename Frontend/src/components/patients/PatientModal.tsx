
import Modal from '@/components/common/Modal'
import PatientForm from './PatientForm'
import { Patient } from '@/types/patient.types'

interface PatientModalProps {
  isOpen: boolean
  onClose: () => void
  patient?: Patient | null
  onSuccess: () => void
}

const PatientModal = ({ isOpen, onClose, patient, onSuccess }: PatientModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={patient ? 'Edit Patient' : 'Add New Patient'}
      size="lg"
    >
      <PatientForm
        patient={patient}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default PatientModal
