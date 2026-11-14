import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import AppointmentForm from './AppointmentForm'
import { Appointment } from '@/types/appointment.types'
import { AppointmentType } from '@/types/common.types'

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  appointment?: Appointment | null
  initialPatientId?: string
  /** "yyyy-MM-dd" to start on */
  initialDate?: string
  initialDoctorId?: string
  initialType?: AppointmentType
  onSuccess: () => void
}

const AppointmentModal = ({ isOpen, onClose, appointment, initialPatientId, initialDate, initialDoctorId, initialType, onSuccess }: AppointmentModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">
            {appointment ? 'Reschedule appointment' : 'Book an appointment'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {/* Remount per opening so every booking starts clean */}
          {isOpen && (
            <AppointmentForm
              key={appointment?.appointment_id ?? `new-${initialPatientId ?? ''}-${initialDate ?? ''}-${initialDoctorId ?? ''}`}
              appointment={appointment}
              initialPatientId={initialPatientId}
              initialDate={initialDate}
              initialDoctorId={initialDoctorId}
              initialType={initialType}
              onSuccess={() => {
                onSuccess()
                onClose()
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AppointmentModal
