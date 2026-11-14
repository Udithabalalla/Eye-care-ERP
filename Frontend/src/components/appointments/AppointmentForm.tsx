import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { toast } from 'sonner'
import {
  RiAddLine,
  RiAlertLine,
  RiCalendarLine,
  RiCheckLine,
  RiTimeLine,
  RiUserAddLine,
  RiUserLine,
} from '@remixicon/react'
import { appointmentsApi } from '@/api/appointments.api'
import { patientsApi } from '@/api/patients.api'
import { Appointment, AppointmentFormData, AppointmentUpdateData } from '@/types/appointment.types'
import { AppointmentType, Gender } from '@/types/common.types'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { usePractitioners } from '@/hooks/usePractitioners'
import { apiErrorMessage, cn } from '@/utils/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  QUICK_REASONS,
  VISIT_TYPES,
  buildSlots,
  dateFromKey,
  dayName,
  endTimeOf,
  hoursOf,
  isActiveBooking,
  isWithDoctor,
  summarizeDays,
  timeOf,
  toMinutes,
  todayKey,
  visitTypeLabel,
  worksOn,
} from './appointmentUtils'

// A selectable card in the pickers below (visit type, doctor, day, time)
const CHOICE =
  'h-auto whitespace-normal border-border text-sm font-normal hover:border-primary/40 hover:bg-accent data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary'

const appointmentSchema = z.object({
  patient_id: z.string().min(1, 'Choose a patient'),
  doctor_id: z.string().min(1, 'Choose a doctor'),
  appointment_date: z.string().min(1, 'Choose a day'),
  appointment_time: z.string().min(1, 'Choose a time'),
  duration_minutes: z.number().min(15).max(240),
  type: z.nativeEnum(AppointmentType),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

type AppointmentFormValues = z.infer<typeof appointmentSchema>

const newPatientSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name'),
  phone: z.string().trim().min(10, 'Phone needs at least 10 digits'),
  gender: z.nativeEnum(Gender, { errorMap: () => ({ message: 'Choose one' }) }),
  date_of_birth: z.string().min(1, 'Enter date of birth'),
})

type NewPatientValues = z.infer<typeof newPatientSchema>

interface AppointmentFormProps {
  appointment?: Appointment | null
  initialPatientId?: string
  /** "yyyy-MM-dd" to start on, e.g. the day open on the Appointments page */
  initialDate?: string
  initialDoctorId?: string
  /** e.g. Follow-up when booking from a finished visit */
  initialType?: AppointmentType
  onSuccess: () => void
  onCancel: () => void
}

/** Section heading with a step number, so the form reads top to bottom */
const Step = ({ n, title, children, action }: { n: number; title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{n}</span>
        {title}
      </h3>
      {action}
    </div>
    {children}
  </section>
)

const AppointmentForm = ({ appointment, initialPatientId, initialDate, initialDoctorId, initialType, onSuccess, onCancel }: AppointmentFormProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isEdit = !!appointment
  const { practitioners, isLoading: practitionersLoading } = usePractitioners()

  const startDate = initialDate && initialDate >= todayKey() ? initialDate : todayKey()

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: appointment
      ? {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_date: appointment.appointment_date.split('T')[0],
          appointment_time: timeOf(appointment),
          duration_minutes: appointment.duration_minutes,
          type: appointment.type,
          reason: appointment.reason,
          notes: appointment.notes || '',
        }
      : {
          patient_id: initialPatientId || '',
          doctor_id: initialDoctorId || '',
          appointment_date: startDate,
          appointment_time: '',
          duration_minutes: VISIT_TYPES.find((t) => t.value === initialType)?.minutes ?? 30,
          type: initialType ?? AppointmentType.CONSULTATION,
          reason: '',
          notes: '',
        },
  })

  const patientId = form.watch('patient_id')
  const doctorId = form.watch('doctor_id')
  const date = form.watch('appointment_date')
  const time = form.watch('appointment_time')
  const duration = form.watch('duration_minutes')
  const type = form.watch('type')

  // One practitioner on staff: nothing to choose
  useEffect(() => {
    if (!isEdit && !form.getValues('doctor_id') && practitioners.length === 1) {
      form.setValue('doctor_id', practitioners[0].id, { shouldValidate: true })
    }
  }, [practitioners, isEdit, form])

  // ── Patient search ────────────────────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(patientSearch), 250)
    return () => clearTimeout(t)
  }, [patientSearch])

  const { data: patientResults } = useQuery({
    queryKey: ['patients-list', debouncedSearch],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 20, search: debouncedSearch || undefined }),
    enabled: !isEdit,
  })

  const inResults = (patientResults?.data ?? []).some((p) => p.patient_id === patientId)
  const { data: selectedPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId),
    enabled: !!patientId && !inResults && !isEdit,
  })

  const patientOptions = useMemo<LOVOption[]>(() => {
    const list = [...(patientResults?.data ?? [])]
    if (selectedPatient && !list.some((p) => p.patient_id === selectedPatient.patient_id)) list.unshift(selectedPatient)
    return list.map((p) => ({ value: p.patient_id, label: p.name, subtitle: [p.patient_id, p.phone].filter(Boolean).join(' · ') }))
  }, [patientResults, selectedPatient])

  // ── Quick-add a walk-in patient ───────────────────────────────────────────
  const [addingPatient, setAddingPatient] = useState(false)
  const patientForm = useForm<NewPatientValues>({
    resolver: zodResolver(newPatientSchema),
    defaultValues: { name: '', phone: '', date_of_birth: '' },
  })

  const createPatient = useMutation({
    mutationFn: (values: NewPatientValues) => patientsApi.create(values),
    onSuccess: (patient) => {
      queryClient.setQueryData(['patient', patient.patient_id], patient)
      queryClient.invalidateQueries({ queryKey: ['patients-list'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      form.setValue('patient_id', patient.patient_id, { shouldValidate: true })
      setAddingPatient(false)
      patientForm.reset()
      toast.success(`${patient.name} added as a patient`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not add the patient')),
  })

  // ── Doctor, day and free times ────────────────────────────────────────────
  const practitioner = practitioners.find((p) => p.id === doctorId)
  const schedule = practitioner?.doctor
  const hours = hoursOf(schedule)

  const { data: dayAppointments, isFetching: loadingSlots } = useQuery({
    queryKey: ['appointments', 'day', date],
    queryFn: () => appointmentsApi.getAllInRange(date, date),
    enabled: !!doctorId && !!date,
  })
  const dayBookings = useMemo(
    () =>
      dayAppointments?.filter((apt) =>
        isWithDoctor(apt, { id: doctorId, name: practitioner?.name ?? appointment?.doctor_name }),
      ),
    [dayAppointments, doctorId, practitioner?.name, appointment?.doctor_name],
  )

  const slots = useMemo(
    () =>
      buildSlots({
        start: hours.start,
        end: hours.end,
        duration,
        dayKey: date,
        booked: dayBookings ?? [],
        ignoreId: appointment?.appointment_id,
      }),
    [hours.start, hours.end, duration, date, dayBookings, appointment?.appointment_id],
  )
  const openSlots = slots.filter((s) => !s.past)
  const freeCount = openSlots.filter((s) => !s.takenBy).length

  // A typed-in time that is not on the grid (or the original time when editing)
  const [customTime, setCustomTime] = useState(false)
  const timeOnGrid = slots.some((s) => s.time === time)
  const clash = useMemo(() => {
    if (!time) return undefined
    const from = toMinutes(time)
    return (dayBookings ?? [])
      .filter((a) => a.appointment_id !== appointment?.appointment_id && isActiveBooking(a))
      .find((a) => from < toMinutes(timeOf(a)) + a.duration_minutes && from + duration > toMinutes(timeOf(a)))
  }, [time, duration, dayBookings, appointment?.appointment_id])

  // Changing doctor, day or length can make the chosen time unavailable
  useEffect(() => {
    if (!time || customTime) return
    const slot = slots.find((s) => s.time === time)
    if (slot && (slot.takenBy || slot.past)) form.setValue('appointment_time', '')
  }, [slots, time, customTime, form])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd')), [])
  const [calendarOpen, setCalendarOpen] = useState(false)

  // ── Save ──────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: AppointmentFormData) => appointmentsApi.create(data),
    onSuccess: () => {
      invalidate()
      toast.success('Appointment booked')
      onSuccess()
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not book the appointment')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: AppointmentUpdateData) => appointmentsApi.update(appointment!.appointment_id, data),
    onSuccess: () => {
      invalidate()
      toast.success('Appointment updated')
      onSuccess()
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the appointment')),
  })

  const onSubmit = (values: AppointmentFormValues) => {
    // The reason is optional here; the server wants at least a few words
    const typed = values.reason?.trim() || ''
    const reason = typed.length >= 5 ? typed : [visitTypeLabel(values.type), typed].filter(Boolean).join(' – ')
    const payload = { ...values, reason, notes: values.notes?.trim() || undefined }
    if (isEdit) {
      // The patient is fixed once booked
      const changes: AppointmentUpdateData & { patient_id?: string } = { ...payload }
      delete changes.patient_id
      updateMutation.mutate(changes)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const ready = !!patientId && !!doctorId && !!date && !!time
  const patientName =
    appointment?.patient_name ?? patientOptions.find((p) => p.value === patientId)?.label

  const pickType = (value: AppointmentType) => {
    form.setValue('type', value)
    const preset = VISIT_TYPES.find((t) => t.value === value)
    if (preset) form.setValue('duration_minutes', preset.minutes)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* ── Left: who and why ─────────────────────────────────────── */}
          <div className="space-y-6">
            <Step
              n={1}
              title="Patient"
              action={
                !isEdit && !addingPatient ? (
                  <Button type="button" variant="ghost" size="sm" className="-mr-2 text-primary" onClick={() => setAddingPatient(true)}>
                    <RiUserAddLine />
                    New patient
                  </Button>
                ) : null
              }
            >
              {isEdit ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <RiUserLine className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{appointment!.patient_name}</p>
                    <p className="text-xs text-muted-foreground">{appointment!.patient_id}</p>
                  </div>
                </div>
              ) : addingPatient ? (
                <Form {...patientForm}>
                  <div className="fade-enter space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-medium">Add a walk-in patient</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={patientForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Full name</FormLabel>
                            <FormControl><Input autoFocus placeholder="e.g. Nimal Perera" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={patientForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl><Input inputMode="tel" placeholder="07X XXX XXXX" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={patientForm.control}
                        name="date_of_birth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of birth</FormLabel>
                            <FormControl><Input type="date" max={todayKey()} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={patientForm.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Gender</FormLabel>
                            <div className="flex gap-2">
                              {[Gender.FEMALE, Gender.MALE, Gender.OTHER].map((g) => (
                                <Button
                                  key={g}
                                  type="button"
                                  size="sm"
                                  variant={field.value === g ? 'default' : 'outline'}
                                  className="flex-1 capitalize"
                                  onClick={() => field.onChange(g)}
                                >
                                  {g}
                                </Button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAddingPatient(false)}>
                        Back to search
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={createPatient.isPending}
                        onClick={patientForm.handleSubmit((values) => createPatient.mutate(values))}
                      >
                        <RiAddLine />
                        {createPatient.isPending ? 'Adding…' : 'Add patient'}
                      </Button>
                    </div>
                  </div>
                </Form>
              ) : (
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <SearchableLOV
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={patientOptions}
                          onSearch={setPatientSearch}
                          placeholder="Search by name, phone or ID"
                          error={fieldState.error?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </Step>

            <Step n={2} title="Visit">
              <ToggleGroup
                type="single"
                variant="outline"
                value={type}
                onValueChange={(value) => value && pickType(value as AppointmentType)}
                aria-label="Visit type"
                className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"
              >
                {VISIT_TYPES.map((t) => (
                  <ToggleGroupItem
                    key={t.value}
                    value={t.value}
                    className={cn(CHOICE, 'flex-col items-start gap-0 rounded-lg px-3 py-2 text-left data-[state=on]:font-medium')}
                  >
                    {t.label}
                    <span className="block text-xs font-normal text-muted-foreground">{t.minutes} min</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="space-y-2">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={form.watch('reason') ?? ''}
                  onValueChange={(value) => value && form.setValue('reason', value)}
                  aria-label="Common reasons"
                  className="flex-wrap justify-start gap-1.5"
                >
                  {QUICK_REASONS.map((r) => (
                    <ToggleGroupItem
                      key={r}
                      value={r}
                      className={cn(CHOICE, 'rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground')}
                    >
                      {r}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Reason for the visit (optional)" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </Step>

            <Step n={3} title="Doctor">
              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    {practitionersLoading ? (
                      <p className="text-sm text-muted-foreground">Loading doctors…</p>
                    ) : practitioners.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm">
                        <p className="font-medium">No doctors set up yet</p>
                        <p className="mt-0.5 text-muted-foreground">Add a doctor with their working days, then book.</p>
                        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => { onCancel(); navigate('/doctors') }}>
                          Go to Doctors
                        </Button>
                      </div>
                    ) : practitioners.length > 6 ? (
                      <SearchableLOV
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={practitioners.map((p) => ({ value: p.id, label: p.name, subtitle: p.title }))}
                        placeholder="Choose a doctor"
                      />
                    ) : (
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value ?? ''}
                        onValueChange={(value) => value && field.onChange(value)}
                        aria-label="Doctor"
                        className="grid w-full gap-2 sm:grid-cols-2"
                      >
                        {practitioners.map((p) => {
                          const selected = field.value === p.id
                          const off = !!p.doctor && !worksOn(p.doctor, date)
                          return (
                            <ToggleGroupItem
                              key={p.id}
                              value={p.id}
                              className={cn(CHOICE, 'items-start justify-start gap-2.5 rounded-lg px-3 py-2.5 text-left data-[state=on]:text-foreground')}
                            >
                              <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                                {selected && <RiCheckLine className="size-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{p.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {p.title}
                                  {p.doctor ? ` · ${summarizeDays(p.doctor.available_days)} ${p.doctor.available_time_start}–${p.doctor.available_time_end}` : ''}
                                </span>
                                {off && <span className="mt-0.5 block text-xs text-warning">Off on {dayName(date)}s</span>}
                              </span>
                            </ToggleGroupItem>
                          )
                        })}
                      </ToggleGroup>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Step>
          </div>

          {/* ── Right: when ───────────────────────────────────────────── */}
          <div className="space-y-6">
            <Step n={4} title="Day">
              <ToggleGroup
                type="single"
                variant="outline"
                value={days.includes(date) ? date : ''}
                onValueChange={(value) => value && form.setValue('appointment_date', value, { shouldValidate: true })}
                aria-label="Day"
                className="grid w-full grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8"
              >
                {days.map((d, i) => {
                  const selected = date === d
                  const off = !!schedule && !worksOn(schedule, d)
                  const dt = dateFromKey(d)
                  return (
                    <ToggleGroupItem
                      key={d}
                      value={d}
                      className={cn(
                        CHOICE,
                        'flex-col gap-0 rounded-lg px-1 py-1.5 text-center data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                        off && !selected && 'opacity-50',
                      )}
                      title={off ? `${practitioner?.name} is off on ${dayName(d)}s` : undefined}
                    >
                      <span className="text-[11px] font-medium uppercase">{i === 0 ? 'Today' : i === 1 ? 'Tmrw' : format(dt, 'EEE')}</span>
                      <span className="text-base font-semibold leading-tight">{format(dt, 'd')}</span>
                      <span className={cn('text-[10px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{off ? 'Off' : format(dt, 'MMM')}</span>
                    </ToggleGroupItem>
                  )
                })}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-auto flex-col gap-0.5 rounded-lg px-1 py-1.5 text-center text-xs font-normal',
                        date && !days.includes(date)
                          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:bg-primary'
                          : 'border-dashed text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <RiCalendarLine className="size-4" />
                      {date && !days.includes(date) ? format(dateFromKey(date), 'd MMM') : 'Later'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date ? dateFromKey(date) : undefined}
                      defaultMonth={date ? dateFromKey(date) : undefined}
                      disabled={[{ before: new Date() }, ...(schedule ? [(d: Date) => !worksOn(schedule, format(d, 'yyyy-MM-dd'))] : [])]}
                      onSelect={(d) => {
                        if (!d) return
                        form.setValue('appointment_date', format(d, 'yyyy-MM-dd'), { shouldValidate: true })
                        setCalendarOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </ToggleGroup>
              {schedule && date && !worksOn(schedule, date) && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <RiAlertLine className="size-3.5" />
                  {practitioner?.name} doesn't usually work on {dayName(date)}s. You can still book.
                </p>
              )}
            </Step>

            <Step
              n={5}
              title="Time"
              action={
                doctorId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Length</span>
                    <Select value={String(duration)} onValueChange={(v) => form.setValue('duration_minutes', Number(v))}>
                      <SelectTrigger size="sm" className="w-24" aria-label="Appointment length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 30, 45, 60, 90].map((m) => (
                          <SelectItem key={m} value={String(m)}>{m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ' 30' : ''}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null
              }
            >
              {!doctorId ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Choose a doctor to see their free times.
                </p>
              ) : (
                <FormField
                  control={form.control}
                  name="appointment_time"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      {loadingSlots && !dayBookings ? (
                        <p className="text-sm text-muted-foreground">Checking the diary…</p>
                      ) : openSlots.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          {date === todayKey() ? 'No times left today. Pick another day, or enter a time below.' : 'No times in working hours. Enter a time below.'}
                        </p>
                      ) : (
                        <div key={`${doctorId}-${date}-${duration}`} className="fade-enter space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {freeCount} free {freeCount === 1 ? 'time' : 'times'} · {hours.start}–{hours.end}
                            {!schedule && ' (usual clinic hours)'}
                          </p>
                          {(['Morning', 'Afternoon', 'Evening'] as const).map((part) => {
                            const inPart = openSlots.filter((s) => {
                              const m = toMinutes(s.time)
                              return part === 'Morning' ? m < 720 : part === 'Afternoon' ? m >= 720 && m < 1020 : m >= 1020
                            })
                            if (inPart.length === 0) return null
                            return (
                              <div key={part}>
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{part}</p>
                                <ToggleGroup
                                  type="single"
                                  variant="outline"
                                  value={customTime ? '' : field.value ?? ''}
                                  onValueChange={(value) => {
                                    if (!value) return
                                    setCustomTime(false)
                                    field.onChange(value)
                                  }}
                                  aria-label={`${part} times`}
                                  className="grid w-full grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6"
                                >
                                  {inPart.map((slot) => (
                                    <ToggleGroupItem
                                      key={slot.time}
                                      value={slot.time}
                                      disabled={!!slot.takenBy}
                                      title={slot.takenBy ? `Booked: ${slot.takenBy}` : `${slot.time}–${endTimeOf(slot.time, duration)}`}
                                      className={cn(
                                        CHOICE,
                                        'h-9 rounded-md tabular-nums hover:border-primary hover:bg-primary/5 data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground',
                                        slot.takenBy && 'border-transparent bg-muted text-muted-foreground/60 line-through disabled:opacity-100',
                                      )}
                                    >
                                      {slot.time}
                                    </ToggleGroupItem>
                                  ))}
                                </ToggleGroup>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <RiTimeLine className="size-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Another time:</span>
                        <Input
                          type="time"
                          className="h-8 w-32"
                          value={customTime || (field.value && !timeOnGrid) ? field.value : ''}
                          onChange={(e) => { setCustomTime(true); field.onChange(e.target.value) }}
                        />
                      </div>
                      {clash && (
                        <p className="flex items-center gap-1.5 text-xs text-warning">
                          <RiAlertLine className="size-3.5" />
                          Overlaps {clash.patient_name} at {timeOf(clash)}.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </Step>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Note for the doctor (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="e.g. Brings old glasses; prefers afternoon calls" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Summary and confirm ─────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col gap-3 border-t border-border bg-background/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {ready ? (
              <>
                <span className="font-medium text-foreground">{format(dateFromKey(date), 'EEE d MMM')}, {time}–{endTimeOf(time, duration)}</span>
                {' · '}{practitioner?.name ?? appointment?.doctor_name}
                {patientName ? ` · ${patientName}` : ''}
              </>
            ) : (
              'Choose a patient, doctor, day and time.'
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !ready}>
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Book appointment'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

export default AppointmentForm
