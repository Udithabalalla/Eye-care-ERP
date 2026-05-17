import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appointmentsApi } from '@/api/appointments.api'
import { patientsApi } from '@/api/patients.api'
import { Appointment, AppointmentFormData } from '@/types/appointment.types'
import { AppointmentType } from '@/types/common.types'
import toast from 'react-hot-toast'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { doctorsApi } from '@/api/doctors.api'
import { safeDate } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  initialPatientId?: string
  onSuccess: () => void
  onCancel: () => void
}

const AppointmentForm = ({ appointment, initialPatientId, onSuccess, onCancel }: AppointmentFormProps) => {
  const queryClient = useQueryClient()
  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100 }),
  })

  const { data: doctors } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => doctorsApi.getAll({ active_only: true }),
  })

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: appointment
      ? {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_date: safeDate(appointment.appointment_date),
          appointment_time: appointment.appointment_time.includes('T')
            ? appointment.appointment_time.split('T')[1].substring(0, 5)
            : appointment.appointment_time.substring(0, 5),
          duration_minutes: appointment.duration_minutes,
          type: appointment.type,
          reason: appointment.reason,
          notes: appointment.notes || '',
        }
      : {
          patient_id: initialPatientId || '',
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
    onError: () => toast.error('Failed to schedule appointment'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppointmentFormData>) =>
      appointmentsApi.update(appointment!.appointment_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment updated successfully')
      onSuccess()
    },
    onError: () => toast.error('Failed to update appointment'),
  })

  const onSubmit = (data: AppointmentFormValues) => {
    if (appointment) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as AppointmentFormData)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">Appointment Details</p>
            <p className="text-sm text-muted-foreground mt-0.5">Schedule a patient visit with a doctor.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Patient <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <SearchableLOV
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={
                        patients?.data?.map((p): LOVOption => ({
                          value: p.patient_id,
                          label: p.name,
                          subtitle: p.patient_id,
                        })) || []
                      }
                      placeholder="Select patient"
                      error={fieldState.error?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Doctor <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <SearchableLOV
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={
                        doctors?.map((d): LOVOption => ({
                          value: d.doctor_id,
                          label: d.name,
                          subtitle: d.specialization,
                        })) || []
                      }
                      placeholder="Select doctor"
                      error={fieldState.error?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appointment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appointment_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration <span className="text-destructive">*</span></FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value ?? 30)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment Type <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="screening">Screening</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-base font-semibold text-foreground">Visit Information</p>

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for Visit <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Describe the reason for this appointment..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Optional notes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : appointment ? 'Update Appointment' : 'Schedule Appointment'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default AppointmentForm
