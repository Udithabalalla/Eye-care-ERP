import Modal from '@/components/common/Modal'
import PrescriptionForm from './PrescriptionForm'
import { Prescription } from '@/types/prescription.types'

interface PrescriptionModalProps {
    isOpen: boolean
    onClose: () => void
    prescription?: Prescription | null
    onSuccess: () => void
}

const PrescriptionModal = ({ isOpen, onClose, prescription, onSuccess }: PrescriptionModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={prescription ? 'Edit Prescription' : 'New Prescription'}
            size="xl"
        >
            <PrescriptionForm
                prescription={prescription}
                onSuccess={() => {
                    onSuccess()
                    onClose()
                }}
                onCancel={onClose}
            />
        </Modal>
    )
}

export default PrescriptionModal
