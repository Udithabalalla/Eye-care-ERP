
import { X, Calendar, User, FileText, Check } from 'lucide-react'
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Select Prescription</h3>
                        <p className="text-sm text-gray-500">Choose a prescription to link to this invoice</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-3">
                    {prescriptions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
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
                                        ? 'border-blue-500 bg-blue-50/50'
                                        : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }
                `}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(prescription.prescription_date).toLocaleDateString()}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className={new Date(prescription.valid_until) < new Date() ? 'text-red-500' : 'text-green-600'}>
                                                Valid until {new Date(prescription.valid_until).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{prescription.doctor_name}</span>
                                        </div>

                                        {prescription.diagnosis && (
                                            <div className="flex items-start space-x-2">
                                                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                                <span className="text-sm text-gray-600">{prescription.diagnosis}</span>
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
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
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
