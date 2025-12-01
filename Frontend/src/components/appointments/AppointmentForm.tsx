import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appointmentsApi } from '@/api/appointments.api'
import { patientsApi } from '@/api/patients.api'
import { Appointment, AppointmentFormData } from '@/types/appointment.types'
import { AppointmentType, AppointmentStatus } from '@/types/common.types'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const appointmentSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  doctor_id: z.string().min(1, 'Doctor is required'),
  appointment_date: z.string(),
  appointment_time: z.string(),
  duration_minutes: z.number().min(15).max(240),
  type: z.nativeEnum(AppointmentType),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  notes: z.string().optional(),
})

type AppointmentFormValues = z.infer<typeof appointmentSchema>

interface AppointmentFormProps {
  appointment?: Appointment | null
  onSuccess: () => void
  onCancel: () => void
}

const AppointmentForm = ({ appointment, onSuccess, onCancel }: AppointmentFormProps) => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100 }),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: appointment
      ? {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_date: appointment.appointment_date.split('T')[0],
          appointment_time: appointment.appointment_time.split('T')[1].substring(0, 5),
          duration_minutes: appointment.duration_minutes,
          type: appointment.type,
          reason: appointment.reason,
          notes: appointment.notes || '',
        }
      : {
          duration_minutes: 30,
          type: AppointmentType.CONSULTATION,
        },
  })

  const createMutation = useMutation({
    mutationFn: (data: AppointmentFormData) => appointmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment scheduled successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to schedule appointment')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppointmentFormData>) =>
      appointmentsApi.update(appointment!.appointment_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment updated successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update appointment')
    },
  })

  const onSubmit = (data: AppointmentFormValues) => {
    if (appointment) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as AppointmentFormData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Patient Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient *
          </label>
          <select {...register('patient_id')} className="input">
            <option value="">Select patient</option>
            {patients?.data.map((patient) => (
              <option key={patient.patient_id} value={patient.patient_id}>
                {patient.name} - {patient.patient_id}
              </option>
            ))}
          </select>
          {errors.patient_id && (
            <p className="text-sm text-red-600 mt-1">{errors.patient_id.message}</p>
          )}
        </div>

        {/* Doctor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Doctor *
          </label>
          <select {...register('doctor_id')} className="input">
            <option value="">Select doctor</option>
            <option value="USR000002">Dr. Sarah Johnson</option>
            <option value="USR000004">Dr. Michael Chen</option>
          </select>
          {errors.doctor_id && (
            <p className="text-sm text-red-600 mt-1">{errors.doctor_id.message}</p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date *
          </label>
          <input type="date" {...register('appointment_date')} className="input" />
          {errors.appointment_date && (
            <p className="text-sm text-red-600 mt-1">{errors.appointment_date.message}</p>
          )}
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time *
          </label>
          <input type="time" {...register('appointment_time')} className="input" />
          {errors.appointment_time && (
            <p className="text-sm text-red-600 mt-1">{errors.appointment_time.message}</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (minutes) *
          </label>
          <select {...register('duration_minutes', { valueAsNumber: true })} className="input">
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
          </select>
          {errors.duration_minutes && (
            <p className="text-sm text-red-600 mt-1">{errors.duration_minutes.message}</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Type *
          </label>
          <select {...register('type')} className="input">
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="emergency">Emergency</option>
            <option value="screening">Screening</option>
          </select>
          {errors.type && (
            <p className="text-sm text-red-600 mt-1">{errors.type.message}</p>
          )}
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Visit *
        </label>
        <textarea {...register('reason')} rows={2} className="input" />
        {errors.reason && (
          <p className="text-sm text-red-600 mt-1">{errors.reason.message}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes
        </label>
        <textarea {...register('notes')} rows={2} className="input" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting
            ? 'Saving...'
            : appointment
            ? 'Update Appointment'
            : 'Schedule Appointment'}
        </button>
      </div>
    </form>
  )
}

export default AppointmentForm
