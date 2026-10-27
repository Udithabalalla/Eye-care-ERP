import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import {
  RiAddLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMailLine,
  RiMore2Line,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiStethoscopeLine,
  RiUserAddLine,
} from '@remixicon/react'
import { doctorsApi } from '@/api/doctors.api'
import { appointmentsApi } from '@/api/appointments.api'
import { Doctor, DoctorFormData } from '@/types/doctor.types'
import { useClinicalUsers, isSamePerson } from '@/hooks/usePractitioners'
import { formatCurrency, getInitials } from '@/utils/formatters'
import { apiErrorMessage, cn } from '@/utils/helpers'
import Modal from '@/components/common/Modal'
import DoctorForm from '@/components/doctors/DoctorForm'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import { WEEK, isActiveBooking, isWithDoctor, timeOf, todayKey, worksOn } from '@/components/appointments/appointmentUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

type Filter = 'all' | 'today' | 'inactive'
type Editor = { doctor: Doctor | null; prefill?: Partial<DoctorFormData> } | null

const Doctors = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editor, setEditor] = useState<Editor>(null)
  const [bookWith, setBookWith] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Doctor | null>(null)
  const today = todayKey()

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.getAll({ limit: 100 }),
  })
  const { data: clinicalUsers = [] } = useClinicalUsers()
  const { data: todays } = useQuery({
    queryKey: ['appointments', 'day', today],
    queryFn: () => appointmentsApi.getAllInRange(today, today),
  })

  // Staff with a doctor or optometrist login but no schedule on this page yet
  const withoutProfile = clinicalUsers.filter((u) => !doctors.some((d) => isSamePerson(d, u)))

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['doctors'] })
    queryClient.invalidateQueries({ queryKey: ['doctors-list'] })
  }

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: DoctorFormData }) => (id ? doctorsApi.update(id, data) : doctorsApi.create(data)),
    onSuccess: (_, { id, data }) => {
      refresh()
      toast.success(id ? `${data.name} updated` : `${data.name} added`)
      setEditor(null)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not save the doctor')),
  })

  const activeMutation = useMutation({
    mutationFn: (doctor: Doctor) => doctorsApi.update(doctor.doctor_id, { is_active: !doctor.is_active }),
    onSuccess: (_, doctor) => {
      refresh()
      toast.success(doctor.is_active ? `${doctor.name} no longer takes appointments` : `${doctor.name} takes appointments again`)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the doctor')),
  })

  const deleteMutation = useMutation({
    mutationFn: (doctor: Doctor) => doctorsApi.delete(doctor.doctor_id),
    onSuccess: (_, doctor) => {
      refresh()
      toast.success(`${doctor.name} deleted`)
      setToDelete(null)
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not delete the doctor')),
  })

  const bookingsFor = (doctor: Doctor) =>
    (todays ?? [])
      .filter((a) => isActiveBooking(a) && isWithDoctor(a, { id: doctor.doctor_id, name: doctor.name }))
      .sort((a, b) => timeOf(a).localeCompare(timeOf(b)))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return doctors
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q))
      .filter((d) => (filter === 'inactive' ? !d.is_active : filter === 'today' ? d.is_active && worksOn(d, today) : true))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
  }, [doctors, search, filter, today])

  const counts = {
    all: doctors.length,
    today: doctors.filter((d) => d.is_active && worksOn(d, today)).length,
    inactive: doctors.filter((d) => !d.is_active).length,
  }
  const nowHHmm = format(new Date(), 'HH:mm')

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Doctors</h1>
          <p className="text-sm text-muted-foreground">Who sees patients, and when they're in.</p>
        </div>
        <Button className="w-full md:w-auto" onClick={() => setEditor({ doctor: null })}>
          <RiAddLine />
          Add doctor
        </Button>
      </section>

      {withoutProfile.length > 0 && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium">
                {withoutProfile.length === 1 ? '1 staff member has' : `${withoutProfile.length} staff members have`} a doctor login but no working hours yet
              </p>
              <p className="text-sm text-muted-foreground">They can be booked already. Add their days and hours so bookings show their real free times.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {withoutProfile.map((u) => (
                <Button
                  key={u.user_id}
                  variant="outline"
                  size="sm"
                  className="bg-background"
                  onClick={() =>
                    setEditor({
                      doctor: null,
                      prefill: {
                        name: u.name,
                        email: u.email,
                        contact_number: u.phone,
                        specialization: u.role === 'optometrist' ? 'Optometrist' : 'Ophthalmologist',
                      },
                    })
                  }
                >
                  <RiUserAddLine />
                  Set up {u.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {([
            ['all', 'All'],
            ['today', 'In today'],
            ['inactive', 'Not taking bookings'],
          ] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)}>
              {label}
              <span className={cn('text-xs', filter === key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{counts[key]}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or specialization" className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading doctors…</p>
      ) : visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <RiStethoscopeLine className="mx-auto size-10 text-muted-foreground/60" />
            <p className="mt-3 font-medium">{doctors.length === 0 ? 'No doctors yet' : 'No doctors match'}</p>
            {doctors.length === 0 && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Add the people who see patients, with the days and hours they work.</p>
                <Button className="mt-4" onClick={() => setEditor({ doctor: null })}>
                  <RiAddLine />
                  Add doctor
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((doctor) => {
            const inToday = doctor.is_active && worksOn(doctor, today)
            const bookings = bookingsFor(doctor)
            const next = bookings.find((a) => timeOf(a) >= nowHHmm && a.status !== 'completed')
            return (
              <Card key={doctor.doctor_id} className={cn('border-border/60', !doctor.is_active && 'opacity-70')}>
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(doctor.name.replace(/^dr\.?\s+/i, ''))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{doctor.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[doctor.specialization, doctor.qualification, doctor.experience_years ? `${doctor.experience_years} yrs` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="-mr-2 -mt-1" aria-label={`More for ${doctor.name}`}>
                          <RiMore2Line />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem className="gap-2" onSelect={() => setEditor({ doctor })}>
                          <RiEditLine className="size-4" />
                          Edit details and hours
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onSelect={() => activeMutation.mutate(doctor)}>
                          {doctor.is_active ? <RiPauseCircleLine className="size-4" /> : <RiPlayCircleLine className="size-4" />}
                          {doctor.is_active ? 'Stop taking bookings' : 'Start taking bookings'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onSelect={() => setToDelete(doctor)}>
                          <RiDeleteBinLine className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Today at a glance */}
                  <div className={cn('rounded-lg px-3 py-2 text-sm', inToday ? 'bg-emerald-500/10' : 'bg-muted/60')}>
                    {!doctor.is_active ? (
                      <span className="text-muted-foreground">Not taking bookings</span>
                    ) : inToday ? (
                      <>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">In today</span>
                        <span className="text-muted-foreground"> · {doctor.available_time_start}–{doctor.available_time_end}</span>
                        <span className="block text-muted-foreground">
                          {bookings.length === 0
                            ? 'Nothing booked yet'
                            : `${bookings.length} booked${next ? ` · next ${timeOf(next)} ${next.patient_name}` : ''}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Off today</span>
                    )}
                  </div>

                  {/* Week */}
                  <div>
                    <div className="flex gap-1">
                      {WEEK.map((day) => {
                        const works = doctor.available_days.includes(day)
                        return (
                          <span
                            key={day}
                            title={`${day}: ${works ? `${doctor.available_time_start}–${doctor.available_time_end}` : 'off'}`}
                            className={cn(
                              'flex h-7 flex-1 items-center justify-center rounded text-xs font-medium',
                              works ? 'bg-primary text-primary-foreground' : 'border border-dashed border-border text-muted-foreground/60',
                            )}
                          >
                            {day.slice(0, 2)}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {doctor.contact_number && (
                      <p className="flex items-center gap-2"><RiPhoneLine className="size-4" />{doctor.contact_number}</p>
                    )}
                    {doctor.email && (
                      <p className="flex items-center gap-2 truncate"><RiMailLine className="size-4 shrink-0" />{doctor.email}</p>
                    )}
                    <p>Consultation {formatCurrency(doctor.consultation_fee)}</p>
                  </div>

                  <div className="mt-auto flex gap-2 pt-1">
                    <Button size="sm" className="flex-1" disabled={!doctor.is_active} onClick={() => setBookWith(doctor.doctor_id)}>
                      <RiAddLine />
                      Book
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <Link to={`/appointments?doctor=${doctor.doctor_id}`}>
                        <RiCalendarLine />
                        Diary
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.doctor ? `Edit ${editor.doctor.name}` : 'Add a doctor'}
        size="md"
      >
        {editor && (
          <DoctorForm
            key={editor.doctor?.doctor_id ?? editor.prefill?.name ?? 'new'}
            doctor={editor.doctor}
            prefill={editor.prefill}
            isPending={saveMutation.isPending}
            onSubmit={(data) => saveMutation.mutate({ id: editor.doctor?.doctor_id, data })}
            onCancel={() => setEditor(null)}
          />
        )}
      </Modal>

      <AppointmentModal
        isOpen={!!bookWith}
        onClose={() => setBookWith(null)}
        initialDoctorId={bookWith ?? undefined}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open) setToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their profile and working hours are removed. Past appointments and prescriptions keep their name.
              If they are only away for a while, use "Stop taking bookings" instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => toDelete && deleteMutation.mutate(toDelete)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete doctor'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Doctors
