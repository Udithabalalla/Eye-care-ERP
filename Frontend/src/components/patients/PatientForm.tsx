import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { Patient, PatientFormData } from '@/types/patient.types'
import { Gender } from '@/types/common.types'
import toast from 'react-hot-toast'
import { safeDate } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'

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
    // Clean up empty optional fields before sending to API
    const cleanedData: any = { ...data }

    // Remove empty email (empty string fails EmailStr validation)
    if (!cleanedData.email) {
      delete cleanedData.email
    }

    // Remove address if all fields are empty
    if (cleanedData.address) {
      const { country, ...addrFields } = cleanedData.address
      const hasValue = Object.values(addrFields).some((v) => v && String(v).trim())
      if (!hasValue) {
        delete cleanedData.address
      }
    }

    // Remove emergency_contact if all fields are empty
    if (cleanedData.emergency_contact) {
      const hasValue = Object.values(cleanedData.emergency_contact).some(
        (v) => v && String(v).trim()
      )
      if (!hasValue) {
        delete cleanedData.emergency_contact
      }
    }

    // Remove empty notes
    if (!cleanedData.notes?.trim()) {
      delete cleanedData.notes
    }

    if (patient) {
      updateMutation.mutate(cleanedData)
    } else {
      createMutation.mutate(cleanedData as PatientFormData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup className="rounded-xl border border-border bg-card p-6">
        <FieldSet className="gap-5">
          <FieldLegend>Basic Information</FieldLegend>
          <FieldDescription>Core patient details used across the system.</FieldDescription>

          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="patient-name">Full Name *</FieldLabel>
              <Input id="patient-name" placeholder="Enter patient name" {...register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.date_of_birth}>
              <FieldLabel htmlFor="patient-dob">Date of Birth *</FieldLabel>
              <Input id="patient-dob" type="date" {...register('date_of_birth')} />
              <FieldError errors={[errors.date_of_birth]} />
            </Field>

            <Field data-invalid={!!errors.gender}>
              <FieldLabel htmlFor="patient-gender">Gender *</FieldLabel>
              <select
                id="patient-gender"
                {...register('gender')}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <FieldError errors={[errors.gender]} />
            </Field>

            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="patient-phone">Phone *</FieldLabel>
              <Input id="patient-phone" placeholder="+1234567890" {...register('phone')} />
              <FieldError errors={[errors.phone]} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="patient-email">Email</FieldLabel>
              <Input id="patient-email" type="email" placeholder="patient@example.com" {...register('email')} />
              <FieldError errors={[errors.email]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet className="gap-5">
          <FieldLegend>Address</FieldLegend>
          <FieldDescription>Optional location details for correspondence and records.</FieldDescription>

          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="patient-street">Street</FieldLabel>
              <Input id="patient-street" placeholder="Street address" {...register('address.street')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="patient-city">City</FieldLabel>
              <Input id="patient-city" placeholder="City" {...register('address.city')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="patient-state">State</FieldLabel>
              <Input id="patient-state" placeholder="State" {...register('address.state')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="patient-zip">ZIP Code</FieldLabel>
              <Input id="patient-zip" placeholder="ZIP code" {...register('address.zip_code')} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet className="gap-5">
          <FieldLegend>Emergency Contact</FieldLegend>
          <FieldDescription>Used when a quick alternate contact is needed.</FieldDescription>

          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="emergency-name">Name</FieldLabel>
              <Input id="emergency-name" placeholder="Contact name" {...register('emergency_contact.name')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="emergency-relationship">Relationship</FieldLabel>
              <Input id="emergency-relationship" placeholder="Relationship" {...register('emergency_contact.relationship')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="emergency-phone">Phone</FieldLabel>
              <Input id="emergency-phone" placeholder="Contact phone" {...register('emergency_contact.phone')} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>Notes</FieldLegend>
          <FieldDescription>Add any clinical or administrative notes here.</FieldDescription>

          <Field>
            <FieldLabel htmlFor="patient-notes">Notes</FieldLabel>
            <Textarea id="patient-notes" rows={4} placeholder="Optional notes" {...register('notes')} />
          </Field>
        </FieldSet>
      </FieldGroup>

      <Separator />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : patient ? 'Update Patient' : 'Create Patient'}
        </Button>
      </div>
    </form>
  )
}

export default PatientForm

