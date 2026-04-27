import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? 'Edit Patient' : 'Add New Patient'}</DialogTitle>
        </DialogHeader>
        <PatientForm
          patient={patient}
          onSuccess={() => {
            onSuccess()
            onClose()
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export default PatientModal
