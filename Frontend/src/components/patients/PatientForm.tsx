import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { Patient, PatientFormData } from '@/types/patient.types'
import { Gender } from '@/types/common.types'
import toast from 'react-hot-toast'
import { safeDate } from '@/utils/formatters'

const patientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  date_of_birth: z.string(),
  gender: z.nativeEnum(Gender),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional(),
    country: z.string().default('USA'),
  }).optional(),
  emergency_contact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
  }).optional(),
  notes: z.string().optional(),
})

type PatientFormValues = z.infer<typeof patientSchema>

interface PatientFormProps {
  patient?: Patient | null
  onSuccess: () => void
  onCancel: () => void
}

const PatientForm = ({ patient, onSuccess, onCancel }: PatientFormProps) => {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: patient
      ? {
        name: patient.name,
        date_of_birth: safeDate(patient.date_of_birth),
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email || '',
        address: patient.address,
        emergency_contact: patient.emergency_contact,
        notes: patient.notes || '',
      }
      : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: PatientFormData) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Patient created successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to create patient')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PatientFormData>) =>
      patientsApi.update(patient!.patient_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Patient updated successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update patient')
    },
  })

  const onSubmit = (data: PatientFormValues) => {
    if (patient) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as PatientFormData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input {...register('name')} className="input" />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date of Birth *
            </label>
            <input type="date" {...register('date_of_birth')} className="input" />
            {errors.date_of_birth && (
              <p className="text-sm text-red-600 mt-1">{errors.date_of_birth.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender *
            </label>
            <select {...register('gender')} className="input">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {errors.gender && (
              <p className="text-sm text-red-600 mt-1">{errors.gender.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone *
            </label>
            <input {...register('phone')} className="input" placeholder="+1234567890" />
            {errors.phone && (
              <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input type="email" {...register('email')} className="input" />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Street</label>
            <input {...register('address.street')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input {...register('address.city')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <input {...register('address.state')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
            <input {...register('address.zip_code')} className="input" />
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input {...register('emergency_contact.name')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Relationship
            </label>
            <input {...register('emergency_contact.relationship')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input {...register('emergency_contact.phone')} className="input" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea {...register('notes')} rows={3} className="input" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : patient ? 'Update Patient' : 'Create Patient'}
        </button>
      </div>
    </form>
  )
}

export default PatientForm
