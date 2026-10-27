import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import PrescriptionForm from './PrescriptionForm'
import PrescriptionDetail from './PrescriptionDetail'
import { Prescription } from '@/types/prescription.types'

interface PrescriptionModalProps {
    isOpen: boolean
    onClose: () => void
    prescription?: Prescription | null
    onSuccess: () => void
    /** Show the prescription for reference only, with no Edit button */
    readOnly?: boolean
    /** Open an existing prescription straight in the edit form */
    startEditing?: boolean
    /** Open another prescription (e.g. the patient's last one) */
    onSwitchToEdit?: (prescription: Prescription) => void
    /** New prescription for this patient (picked already) */
    initialPatientId?: string
    /** New prescription from an appointment */
    initialDoctorId?: string
    initialDoctorName?: string
    initialAppointmentId?: string
}

const PrescriptionModal = ({
    isOpen,
    onClose,
    prescription,
    onSuccess,
    readOnly = false,
    startEditing = false,
    onSwitchToEdit,
    initialPatientId,
    initialDoctorId,
    initialDoctorName,
    initialAppointmentId,
}: PrescriptionModalProps) => {
    const [editing, setEditing] = useState(startEditing)

    // Each opening starts in the mode the caller asked for
    useEffect(() => {
        if (isOpen) setEditing(startEditing)
    }, [isOpen, startEditing, prescription?.prescription_id])

    const viewing = !!prescription && (readOnly || !editing)
    const title = viewing ? 'Prescription' : prescription ? 'Edit prescription' : 'New prescription'

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={viewing ? 'md' : 'lg'}>
            {isOpen && (viewing ? (
                <PrescriptionDetail
                    prescription={prescription!}
                    onClose={onClose}
                    onEdit={readOnly ? undefined : () => setEditing(true)}
                />
            ) : (
                <PrescriptionForm
                    key={prescription?.prescription_id || `new-${initialPatientId ?? ''}-${initialAppointmentId ?? ''}`}
                    prescription={prescription}
                    initialPatientId={initialPatientId}
                    initialDoctorId={initialDoctorId}
                    initialDoctorName={initialDoctorName}
                    initialAppointmentId={initialAppointmentId}
                    onSuccess={() => {
                        onSuccess()
                        onClose()
                    }}
                    onCancel={() => (prescription && !startEditing ? setEditing(false) : onClose())}
                    onSwitchToEdit={onSwitchToEdit}
                />
            ))}
        </Modal>
    )
}

export default PrescriptionModal
