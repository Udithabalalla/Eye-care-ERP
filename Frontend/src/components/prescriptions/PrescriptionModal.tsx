import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`max-h-[90vh] gap-0 overflow-y-auto p-0 ${viewing ? 'sm:max-w-2xl' : 'sm:max-w-4xl'}`}>
                <DialogHeader className="border-b border-border px-6 py-5">
                    <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                </DialogHeader>
                <div className="p-6">
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
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default PrescriptionModal
