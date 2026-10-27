import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addWeeks, format, isSameDay, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarCheckLine,
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiEyeLine,
  RiLoginBoxLine,
  RiMore2Line,
  RiRepeatLine,
  RiTimeLine,
  RiUserForbidLine,
} from '@remixicon/react'
import { appointmentsApi } from '@/api/appointments.api'
import { Appointment } from '@/types/appointment.types'
import { AppointmentStatus, AppointmentType } from '@/types/common.types'
import { usePractitioners } from '@/hooks/usePractitioners'
import { apiErrorMessage, cn } from '@/utils/helpers'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import {
  STATUS_META,
  dateFromKey,
  dayKeyOf,
  endTimeOf,
  isActiveBooking,
  isWithDoctor,
  timeOf,
  todayKey,
  visitTypeLabel,
} from '@/components/appointments/appointmentUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type BookingDialog =
  | { mode: 'new'; patientId?: string; doctorId?: string; date?: string; type?: AppointmentType }
  | { mode: 'edit'; appointment: Appointment }

const ALL_DOCTORS = 'all'

const Appointments = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDay = searchParams.get('date') || todayKey()
  const doctorFilter = searchParams.get('doctor') || ALL_DOCTORS
  const { practitioners } = usePractitioners()

  const [booking, setBooking] = useState<BookingDialog | null>(null)
  const [rxFor, setRxFor] = useState<Appointment | null>(null)
  const [toCancel, setToCancel] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }
  const goToDay = (key: string) => setParam('date', key === todayKey() ? null : key)

  // The week around the chosen day, Monday first
  const weekStart = startOfWeek(dateFromKey(selectedDay), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'week', weekDays[0]],
    queryFn: () => appointmentsApi.getAllInRange(weekDays[0], weekDays[6]),
  })

  const doctorName = practitioners.find((p) => p.id === doctorFilter)?.name

  const byDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const apt of data ?? []) {
      if (doctorFilter !== ALL_DOCTORS && !isWithDoctor(apt, { id: doctorFilter, name: doctorName })) continue
      ;(map[dayKeyOf(apt)] ??= []).push(apt)
    }
    for (const list of Object.values(map)) list.sort((a, b) => timeOf(a).localeCompare(timeOf(b)))
    return map
  }, [data, doctorFilter, doctorName])

  const dayList = byDay[selectedDay] ?? []
  const counts = {
    waiting: dayList.filter((a) => a.status === AppointmentStatus.SCHEDULED || a.status === AppointmentStatus.CONFIRMED).length,
    checkedIn: dayList.filter((a) => a.status === AppointmentStatus.IN_PROGRESS).length,
    done: dayList.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
    missed: dayList.filter((a) => !isActiveBooking(a)).length,
  }

  // ── Status changes ──────────────────────────────────────────────────────
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ apt, status }: { apt: Appointment; status: AppointmentStatus }) =>
      appointmentsApi.update(apt.appointment_id, { status }),
    onSuccess: (_, { apt, status }) => {
      refresh()
      toast.success(`${apt.patient_name}: ${STATUS_META[status].label.toLowerCase()}`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the appointment')),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ apt, reason }: { apt: Appointment; reason: string }) => appointmentsApi.cancel(apt.appointment_id, reason),
    onSuccess: (_, { apt }) => {
      refresh()
      toast.success(`Cancelled ${apt.patient_name}'s appointment`)
      setToCancel(null)
      setCancelReason('')
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not cancel the appointment')),
  })

  const setStatus = (apt: Appointment, status: AppointmentStatus) => statusMutation.mutate({ apt, status })
  const busyId = statusMutation.isPending ? statusMutation.variables?.apt.appointment_id : undefined

  const selectedDate = dateFromKey(selectedDay)
  const isToday = selectedDay === todayKey()
  const isPastDay = selectedDay < todayKey()

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground">Who's coming in, and what happens next.</p>
        </div>
        <Button
          className="w-full md:w-auto"
          onClick={() => setBooking({ mode: 'new', date: isPastDay ? undefined : selectedDay, doctorId: doctorFilter === ALL_DOCTORS ? undefined : doctorFilter })}
        >
          <RiAddLine />
          Book appointment
        </Button>
      </section>

      {/* ── Day navigation ──────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => goToDay(format(addWeeks(selectedDate, -1), 'yyyy-MM-dd'))}>
                <RiArrowLeftSLine />
              </Button>
              <Button variant="outline" onClick={() => goToDay(todayKey())} disabled={isToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" aria-label="Next week" onClick={() => goToDay(format(addWeeks(selectedDate, 1), 'yyyy-MM-dd'))}>
                <RiArrowRightSLine />
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="ml-1 text-base font-semibold">
                    <RiCalendarLine />
                    {format(selectedDate, 'EEEE, d MMMM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    defaultMonth={selectedDate}
                    onSelect={(d) => {
                      if (!d) return
                      goToDay(format(d, 'yyyy-MM-dd'))
                      setCalendarOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Select value={doctorFilter} onValueChange={(v) => setParam('doctor', v === ALL_DOCTORS ? null : v)}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Doctor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DOCTORS}>All doctors</SelectItem>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((key) => {
              const dt = dateFromKey(key)
              const active = (byDay[key] ?? []).filter(isActiveBooking).length
              const selected = key === selectedDay
              const today = isSameDay(dt, new Date())
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => goToDay(key)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border py-2 transition-colors',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent hover:bg-accent',
                  )}
                >
                  <span className={cn('text-[11px] font-medium uppercase', !selected && 'text-muted-foreground')}>{format(dt, 'EEE')}</span>
                  <span className={cn('text-lg font-semibold leading-tight', today && !selected && 'text-primary')}>{format(dt, 'd')}</span>
                  <span className={cn('h-4 text-[11px]', selected ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                    {active > 0 ? `${active} booked` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── The day's list ──────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-sm">
          <span className="font-semibold">
            {isToday ? 'Today' : format(selectedDate, 'EEEE')}
            {doctorName ? ` · ${doctorName}` : ''}
          </span>
          {dayList.length > 0 && (
            <span className="text-muted-foreground">
              {[
                counts.waiting && `${counts.waiting} to come`,
                counts.checkedIn && `${counts.checkedIn} checked in`,
                counts.done && `${counts.done} completed`,
                counts.missed && `${counts.missed} cancelled or missed`,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Loading appointments…</p>
        ) : dayList.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <RiCalendarCheckLine className="mx-auto size-10 text-muted-foreground/60" />
            <p className="mt-3 font-medium">Nothing booked {isToday ? 'today' : `on ${format(selectedDate, 'EEEE d MMMM')}`}</p>
            {!isPastDay && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Free times show up as soon as you pick a doctor.</p>
                <Button className="mt-4" onClick={() => setBooking({ mode: 'new', date: selectedDay, doctorId: doctorFilter === ALL_DOCTORS ? undefined : doctorFilter })}>
                  <RiAddLine />
                  Book for this day
                </Button>
              </>
            )}
          </div>
        ) : (
          // Keyed by day and doctor so switching days eases in; status updates don't replay it
          <ul key={`${selectedDay}-${doctorFilter}`} className="stagger divide-y divide-border">
            {dayList.map((apt) => {
              const meta = STATUS_META[apt.status]
              const inactive = !isActiveBooking(apt)
              const busy = busyId === apt.appointment_id
              const start = timeOf(apt)
              return (
                <li key={apt.appointment_id} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center', inactive && 'opacity-60')}>
                  {/* Time */}
                  <div className="flex w-24 shrink-0 items-baseline gap-2 sm:block">
                    <p className="text-lg font-semibold tabular-nums leading-tight">{start}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">to {endTimeOf(start, apt.duration_minutes)}</p>
                  </div>

                  {/* Who and why */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/patients?detail=${apt.patient_id}`} className="truncate font-medium hover:text-primary hover:underline">
                        {apt.patient_name}
                      </Link>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', meta.className)}>
                        <span className={cn('size-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {visitTypeLabel(apt.type)} · {apt.doctor_name}
                      {apt.reason && apt.reason !== visitTypeLabel(apt.type) ? ` · ${apt.reason}` : ''}
                    </p>
                    {apt.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground/80">Note: {apt.notes}</p>}
                  </div>

                  {/* Next step */}
                  <div className="flex shrink-0 items-center gap-2">
                    {(apt.status === AppointmentStatus.SCHEDULED || apt.status === AppointmentStatus.CONFIRMED) && (
                      <Button size="sm" disabled={busy} onClick={() => setStatus(apt, AppointmentStatus.IN_PROGRESS)}>
                        <RiLoginBoxLine />
                        Check in
                      </Button>
                    )}
                    {apt.status === AppointmentStatus.IN_PROGRESS && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setRxFor(apt)}>
                          <RiEyeLine />
                          Write prescription
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => setStatus(apt, AppointmentStatus.COMPLETED)}>
                          <RiCheckboxCircleLine />
                          Complete
                        </Button>
                      </>
                    )}
                    {apt.status === AppointmentStatus.COMPLETED && (
                      <Button size="sm" variant="outline" onClick={() => setBooking({ mode: 'new', patientId: apt.patient_id, doctorId: apt.doctor_id, type: AppointmentType.FOLLOW_UP })}>
                        <RiRepeatLine />
                        Book follow-up
                      </Button>
                    )}
                    {inactive && (
                      <Button size="sm" variant="outline" onClick={() => setBooking({ mode: 'new', patientId: apt.patient_id, doctorId: apt.doctor_id, type: apt.type })}>
                        <RiRepeatLine />
                        Rebook
                      </Button>
                    )}

                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`More for ${apt.patient_name}`}>
                          <RiMore2Line />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {apt.status === AppointmentStatus.SCHEDULED && (
                          <DropdownMenuItem className="gap-2" onSelect={() => setStatus(apt, AppointmentStatus.CONFIRMED)}>
                            <RiCalendarCheckLine className="size-4" />
                            Mark as confirmed
                          </DropdownMenuItem>
                        )}
                        {!inactive && apt.status !== AppointmentStatus.COMPLETED && (
                          <DropdownMenuItem className="gap-2" onSelect={() => setBooking({ mode: 'edit', appointment: apt })}>
                            <RiTimeLine className="size-4" />
                            Reschedule
                          </DropdownMenuItem>
                        )}
                        {apt.status !== AppointmentStatus.IN_PROGRESS && (
                          <DropdownMenuItem className="gap-2" onSelect={() => setRxFor(apt)}>
                            <RiEyeLine className="size-4" />
                            Write prescription
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild className="gap-2">
                          <Link to={`/patients?detail=${apt.patient_id}`}>
                            <RiArrowRightSLine className="size-4" />
                            Open patient
                          </Link>
                        </DropdownMenuItem>
                        {(apt.status === AppointmentStatus.SCHEDULED || apt.status === AppointmentStatus.CONFIRMED) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2" onSelect={() => setStatus(apt, AppointmentStatus.NO_SHOW)}>
                              <RiUserForbidLine className="size-4" />
                              Didn't come (no-show)
                            </DropdownMenuItem>
                          </>
                        )}
                        {!inactive && apt.status !== AppointmentStatus.COMPLETED && (
                          <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onSelect={() => setToCancel(apt)}>
                            <RiCloseCircleLine className="size-4" />
                            Cancel appointment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <AppointmentModal
        isOpen={!!booking}
        onClose={() => setBooking(null)}
        appointment={booking?.mode === 'edit' ? booking.appointment : null}
        initialPatientId={booking?.mode === 'new' ? booking.patientId : undefined}
        initialDoctorId={booking?.mode === 'new' ? booking.doctorId : undefined}
        initialDate={booking?.mode === 'new' ? booking.date : undefined}
        initialType={booking?.mode === 'new' ? booking.type : undefined}
        onSuccess={refresh}
      />

      <PrescriptionModal
        isOpen={!!rxFor}
        onClose={() => setRxFor(null)}
        initialPatientId={rxFor?.patient_id}
        initialDoctorId={rxFor?.doctor_id}
        initialDoctorName={rxFor?.doctor_name}
        initialAppointmentId={rxFor?.appointment_id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prescriptions'] })}
      />

      <AlertDialog open={!!toCancel} onOpenChange={(open) => { if (!open) { setToCancel(null); setCancelReason('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {toCancel?.patient_name}'s appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel && `${format(dateFromKey(dayKeyOf(toCancel)), 'EEEE d MMMM')} at ${timeOf(toCancel)} with ${toCancel.doctor_name}. The time becomes free for someone else.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (optional), e.g. patient called to cancel"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => toCancel && cancelMutation.mutate({ apt: toCancel, reason: cancelReason.trim() })}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Appointments
