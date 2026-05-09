import { RiCloseLine, RiCalendarLine, RiUserLine, RiFileTextLine, RiCheckLine } from '@remixicon/react'
import { Prescription } from '@/types/prescription.types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>Select Prescription</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">Choose a prescription to link to this invoice</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                        >
                            <RiCloseLine className="w-5 h-5" />
                        </button>
                    </div>
                </DialogHeader>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {prescriptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No prescriptions found for this patient.
                        </div>
                    ) : (
                        prescriptions.map((prescription) => (
                            <div
                                key={prescription.prescription_id}
                                onClick={() => onSelect(prescription)}
                                className={`relative group cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                    selectedId === prescription.prescription_id
                                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/50'
                                        : 'border-border hover:border-brand-200 hover:bg-secondary'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                            <RiCalendarLine className="w-4 h-4" />
                                            <span>{new Date(prescription.prescription_date).toLocaleDateString()}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className={new Date(prescription.valid_until) < new Date() ? 'text-error-500' : 'text-success-600'}>
                                                Valid until {new Date(prescription.valid_until).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <RiUserLine className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">{prescription.doctor_name}</span>
                                        </div>

                                        {prescription.diagnosis && (
                                            <div className="flex items-start space-x-2">
                                                <RiFileTextLine className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <span className="text-sm text-muted-foreground">{prescription.diagnosis}</span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedId === prescription.prescription_id && (
                                        <div className="absolute top-4 right-4 bg-brand-500 text-white p-1 rounded-full">
                                            <RiCheckLine className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border bg-secondary flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default PrescriptionSelectionModal
