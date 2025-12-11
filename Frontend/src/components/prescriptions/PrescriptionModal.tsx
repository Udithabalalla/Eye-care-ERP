import Modal from '@/components/common/Modal'
import PrescriptionForm from './PrescriptionForm'
import { Prescription } from '@/types/prescription.types'

interface PrescriptionModalProps {
    isOpen: boolean
    onClose: () => void
    prescription?: Prescription | null
    onSuccess: () => void
    readOnly?: boolean
    onSwitchToEdit?: (prescription: Prescription) => void
}

const PrescriptionModal = ({ isOpen, onClose, prescription, onSuccess, readOnly = false, onSwitchToEdit }: PrescriptionModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={readOnly ? 'View Prescription' : (prescription ? 'Edit Prescription' : 'New Prescription')}
            size="xl"
        >
            <PrescriptionForm
                key={prescription?.prescription_id || 'new'}
                prescription={prescription}
                onSuccess={() => {
                    onSuccess()
                    onClose()
                }}
                onCancel={onClose}
                readOnly={readOnly}
                onSwitchToEdit={onSwitchToEdit}
            />
        </Modal>
    )
}

export default PrescriptionModal
