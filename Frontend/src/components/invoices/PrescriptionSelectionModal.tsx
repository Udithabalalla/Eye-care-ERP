
import { XClose, Calendar, User01, File06, Check } from '@untitledui/icons'
import { Prescription } from '@/types/prescription.types'

interface PrescriptionSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    prescriptions: Prescription[]
    onSelect: (prescription: Prescription) => void
    selectedId?: string
}

const PrescriptionSelectionModal = ({
    isOpen,
    onClose,
    prescriptions,
    onSelect,
    selectedId,
}: PrescriptionSelectionModalProps) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Select Prescription</h3>
                        <p className="text-sm text-muted-foreground">Choose a prescription to link to this invoice</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-tertiary transition-colors"
                    >
                        <XClose className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-3">
                    {prescriptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No prescriptions found for this patient.
                        </div>
                    ) : (
                        prescriptions.map((prescription) => (
                            <div
                                key={prescription.prescription_id}
                                onClick={() => onSelect(prescription)}
                                className={`
                  relative group cursor-pointer p-4 rounded-xl border-2 transition-all
                  ${selectedId === prescription.prescription_id
                                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/50'
                                        : 'border-border hover:border-brand-200 hover:bg-tertiary'
                                    }
                `}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(prescription.prescription_date).toLocaleDateString()}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className={new Date(prescription.valid_until) < new Date() ? 'text-error-500' : 'text-success-600'}>
                                                Valid until {new Date(prescription.valid_until).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <User01 className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">{prescription.doctor_name}</span>
                                        </div>

                                        {prescription.diagnosis && (
                                            <div className="flex items-start space-x-2">
                                                <File06 className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <span className="text-sm text-muted-foreground">{prescription.diagnosis}</span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedId === prescription.prescription_id && (
                                        <div className="absolute top-4 right-4 bg-blue-500 text-white p-1 rounded-full">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-secondary flex justify-end">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PrescriptionSelectionModal





