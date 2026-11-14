import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, formatDistanceToNowStrict, parseISO } from 'date-fns'
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiCalendarLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiEyeLine,
  RiFileTextLine,
  RiHeartPulseLine,
  RiLoader4Line,
  RiMailLine,
  RiMore2Line,
  RiPhoneLine,
  RiReceiptLine,
  RiUserLine,
  RiWhatsappLine,
} from '@remixicon/react'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { invoicesApi } from '@/api/invoices.api'
import { appointmentsApi } from '@/api/appointments.api'
import { salesOrdersApi } from '@/api/erp.api'
import { Patient } from '@/types/patient.types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DrawerLoadingBar, DrawerRow, DrawerSection } from '@/components/common/DetailDrawer'
import { SalesOrderStatusBadge } from '@/components/sales-orders/SalesOrderStatusBadge'
import { EyeRxTable } from '@/components/prescriptions/EyeRxTable'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { PatientAvatar } from './PatientAvatar'

export interface PatientDrawerActions {
  onNewOrder: (patient: Patient) => void
  onBookAppointment: (patient: Patient) => void
  onNewPrescription: (patient: Patient) => void
  onEdit: (patient: Patient) => void
  onDelete: (patient: Patient) => void
}

interface Props {
  patientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: PatientDrawerActions
}

const byNewest = <T,>(items: T[], date: (item: T) => string | undefined) =>
  [...items].sort((a, b) => new Date(date(b) || 0).getTime() - new Date(date(a) || 0).getTime())

/** Local numbers (07…) become +94… for WhatsApp */
const whatsappNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `94${digits.slice(1)}`
  return digits
}

const ACTION_TONES = {
  success: 'bg-success/10 text-success hover:bg-success/15 hover:text-success',
  warning: 'bg-warning/15 text-warning-foreground hover:bg-warning/20 hover:text-warning-foreground dark:text-warning dark:hover:text-warning',
  neutral: 'bg-muted/60 text-foreground hover:bg-muted',
} as const

/** A full-width tinted row that takes you to the thing to act on */
function ActionRow({ tone, onClick, children }: { tone: keyof typeof ACTION_TONES; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn('h-auto w-full justify-between gap-2 whitespace-normal rounded-lg px-3 py-2 text-left text-xs font-normal', ACTION_TONES[tone])}
    >
      {children}
    </Button>
  )
}

const ago = (value?: string) => (value ? formatDistanceToNowStrict(parseISO(value), { addSuffix: true }) : undefined)

const APPOINTMENT_TONES: Record<string, string> = {
  scheduled: 'text-info',
  confirmed: 'text-success',
  'in-progress': 'text-warning',
  completed: 'text-muted-foreground',
  cancelled: 'text-muted-foreground line-through',
  'no-show': 'text-destructive',
}

/**
 * Everything about a patient in one place: their eyes, what they've bought,
 * what they owe and when they're next in — with the next things to do for them.
 */
export function PatientDetailSheet({ patientId, open, onOpenChange, actions }: Props) {
  const navigate = useNavigate()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [patientId])

  const enabled = open && !!patientId
  const { data: patient, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetching && isPlaceholderData
  // Related records only for the patient actually on screen
  const forPatient = enabled && !!patient && patient.patient_id === patientId

  const { data: rxData, isLoading: loadingRx } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: () => prescriptionsApi.getByPatientId(patientId!, { page_size: 50 }),
    enabled: forPatient,
  })
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['sales-orders', 'patient', patientId],
    queryFn: () => salesOrdersApi.getAll({ patient_id: patientId!, page_size: 50 }),
    enabled: forPatient,
  })
  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', 'patient', patientId],
    queryFn: () => invoicesApi.getByPatientId(patientId!, { page_size: 100 }),
    enabled: forPatient,
  })
  const { data: appointmentsData } = useQuery({
    queryKey: ['appointments', 'patient', patientId],
    queryFn: () => appointmentsApi.getByPatientId(patientId!, { page_size: 100 }),
    enabled: forPatient,
  })

  const prescriptions = byNewest(rxData?.data ?? [], (rx) => rx.prescription_date)
  const latestRx = prescriptions[0]
  const rxExpired = latestRx?.valid_until ? differenceInCalendarDays(parseISO(latestRx.valid_until), new Date()) < 0 : false

  const orders = byNewest(ordersData?.data ?? [], (o) => o.created_at).filter((o) => o.status !== 'cancelled')
  const invoices = invoicesData?.data ?? []
  const balanceByOrder = new Map(invoices.filter((inv) => inv.sales_order_id).map((inv) => [inv.sales_order_id!, inv]))
  const owing = invoices.filter((inv) => (inv.balance_due ?? 0) > 0 && inv.payment_status !== 'cancelled')
  const balanceDue = owing.reduce((sum, inv) => sum + inv.balance_due, 0)
  const readyOrders = orders.filter((o) => o.status === 'ready')

  const today = new Date().toISOString().slice(0, 10)
  const appointments = byNewest(appointmentsData?.data ?? [], (a) => `${a.appointment_date}T${a.appointment_time || '00:00'}`)
  const upcoming = appointments.filter((a) => a.appointment_date >= today && !['cancelled', 'completed', 'no-show'].includes(a.status)).reverse()
  const past = appointments.filter((a) => !upcoming.includes(a)).slice(0, 5)

  const allergies = patient?.medical_history?.allergies?.filter(Boolean) ?? []
  const address = patient?.address ? [patient.address.street, patient.address.city, patient.address.state, patient.address.zip_code].filter(Boolean).join(', ') : ''

  const goTo = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        {/* ── Header: who, and how to reach them ── */}
        <SheetHeader className="flex-shrink-0 border-b px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-20">
            {patient && <PatientAvatar name={patient.name} seed={patient.patient_id} className="size-11 text-sm" />}
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold text-foreground">{patient?.name ?? '…'}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  {patient && (
                    <>
                      <span>{patient.age} yrs</span>
                      <span>·</span>
                      <span className="capitalize">{patient.gender}</span>
                      <span>·</span>
                      <span className="font-mono">{patient.patient_id}</span>
                      {!patient.is_active && <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium">Inactive</span>}
                    </>
                  )}
                </div>
              </SheetDescription>
            </div>
          </div>
          {patient && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                <a href={`tel:${patient.phone}`}><RiPhoneLine className="size-3.5" />{patient.phone}</a>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                <a href={`https://wa.me/${whatsappNumber(patient.phone)}`} target="_blank" rel="noreferrer"><RiWhatsappLine className="size-3.5" />WhatsApp</a>
              </Button>
              {patient.email && (
                <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                  <a href={`mailto:${patient.email}`}><RiMailLine className="size-3.5" />Email</a>
                </Button>
              )}
            </div>
          )}
        </SheetHeader>
        <DrawerLoadingBar active={isSwitching} />

        <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
          {!patient ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RiLoader4Line className="size-4 animate-spin" />
              Loading patient…
            </div>
          ) : (
            <>
              {/* ── At a glance ── */}
              <div className="space-y-3 border-b px-5 py-4">
                <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">Visits</p>
                    <p className="text-sm font-semibold tabular-nums">{patient.total_visits ?? 0}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">Last visit</p>
                    <p className="truncate text-sm font-semibold">{patient.last_visit ? ago(patient.last_visit) : 'Never'}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">Owes</p>
                    <p className={cn('text-sm font-semibold tabular-nums', balanceDue > 0 ? 'text-warning' : 'text-success')}>
                      {invoicesData ? (balanceDue > 0 ? formatCurrency(balanceDue) : 'Nothing') : '…'}
                    </p>
                  </div>
                </div>

                {/* Things to act on for this patient */}
                {(allergies.length > 0 || readyOrders.length > 0 || rxExpired || owing.length > 0) && (
                  <div className="space-y-1.5">
                    {allergies.length > 0 && (
                      <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 px-3 py-2">
                        <RiAlertLine />
                        <AlertDescription>
                          <span className="font-semibold">Allergies:</span> {allergies.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                    {readyOrders.map((order) => (
                      <ActionRow key={order.order_id} tone="success" onClick={() => goTo(`/sales-orders?detail=${order.order_id}`)}>
                        <span><span className="font-semibold">Ready to collect</span> — {order.order_number}</span>
                        <span className="font-medium">Open ›</span>
                      </ActionRow>
                    ))}
                    {rxExpired && latestRx && (
                      <ActionRow tone="warning" onClick={() => actions.onBookAppointment(patient)}>
                        <span><span className="font-semibold">Due for an eye test</span> — prescription expired {formatDate(latestRx.valid_until, 'dd MMM yyyy')}</span>
                        <span className="font-medium">Book ›</span>
                      </ActionRow>
                    )}
                    {owing.length > 0 && (
                      <ActionRow tone="neutral" onClick={() => goTo(`/invoices?detail=${owing[0].invoice_id}`)}>
                        <span>
                          <span className="font-semibold">{formatCurrency(balanceDue)} to collect</span>
                          {' '}on {owing.length === 1 ? `invoice ${owing[0].invoice_number}` : `${owing.length} invoices`}
                        </span>
                        <span className="font-medium text-primary">Collect ›</span>
                      </ActionRow>
                    )}
                  </div>
                )}
              </div>

              <div className="divide-y divide-border">
                {/* ── Eyes ── */}
                <DrawerSection
                  icon={RiEyeLine}
                  title="Latest prescription"
                  action={
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => actions.onNewPrescription(patient)}>
                      New
                    </Button>
                  }
                >
                  {loadingRx ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLoader4Line className="size-3.5 animate-spin" />Loading…</p>
                  ) : !latestRx ? (
                    <p className="text-sm text-muted-foreground">No prescription on file yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {formatDate(latestRx.prescription_date)}
                          {latestRx.doctor_name ? ` · ${latestRx.doctor_name}` : ''}
                          {latestRx.eye_prescription?.prescription_type ? ` · ${latestRx.eye_prescription.prescription_type.replace(/-/g, ' ')}` : ''}
                        </span>
                        <span className={cn('font-medium', rxExpired ? 'text-warning' : 'text-success')}>
                          {rxExpired ? 'Expired' : `Valid until ${formatDate(latestRx.valid_until, 'dd MMM yyyy')}`}
                        </span>
                      </div>
                      {latestRx.eye_prescription && <EyeRxTable rx={latestRx.eye_prescription} />}
                      {latestRx.diagnosis && <p className="text-xs"><span className="text-muted-foreground">Diagnosis:</span> {latestRx.diagnosis}</p>}
                      {prescriptions.length > 1 && (
                        <Collapsible>
                          <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-primary">
                            Earlier prescriptions ({prescriptions.length - 1})
                            <RiArrowDownSLine className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-3">
                            {prescriptions.slice(1, 6).map((rx) => (
                              <div key={rx.prescription_id} className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">{formatDate(rx.prescription_date)}{rx.doctor_name ? ` · ${rx.doctor_name}` : ''}</p>
                                {rx.eye_prescription && <EyeRxTable rx={rx.eye_prescription} />}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}
                </DrawerSection>

                {/* ── Orders ── */}
                <DrawerSection icon={RiReceiptLine} title={`Orders${orders.length ? ` (${orders.length})` : ''}`}>
                  {loadingOrders ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><RiLoader4Line className="size-3.5 animate-spin" />Loading…</p>
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {orders.slice(0, 8).map((order) => {
                        const invoice = balanceByOrder.get(order.order_id) ?? (order.invoice_id ? invoices.find((inv) => inv.invoice_id === order.invoice_id) : undefined)
                        const due = invoice?.balance_due ?? 0
                        return (
                          <li key={order.order_id}>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => goTo(`/sales-orders?detail=${order.order_id}`)}
                              className="-mx-2 h-auto w-[calc(100%+1rem)] justify-between gap-3 whitespace-normal px-2 py-2 text-left font-normal hover:bg-muted/50"
                            >
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                  {order.order_number}
                                  <SalesOrderStatusBadge status={order.status} />
                                </p>
                                <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-medium tabular-nums">{formatCurrency(order.total_amount)}</p>
                                {due > 0 && <p className="text-[11px] font-medium text-warning">{formatCurrency(due)} due</p>}
                              </div>
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </DrawerSection>

                {/* ── Appointments ── */}
                <DrawerSection
                  icon={RiCalendarLine}
                  title="Appointments"
                  action={
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => actions.onBookAppointment(patient)}>
                      Book
                    </Button>
                  }
                >
                  {upcoming.length === 0 && past.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No appointments yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {[...upcoming, ...past].map((appt) => (
                        <li key={appt.appointment_id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {formatDate(appt.appointment_date, 'EEE dd MMM')}
                              {appt.appointment_time ? ` · ${appt.appointment_time.slice(0, 5)}` : ''}
                            </p>
                            <p className="truncate text-xs capitalize text-muted-foreground">
                              {[appt.type?.replace(/-/g, ' '), appt.doctor_name && `Dr. ${appt.doctor_name}`, appt.reason].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <span className={cn('shrink-0 text-xs font-medium capitalize', APPOINTMENT_TONES[appt.status] ?? 'text-muted-foreground', upcoming.includes(appt) && 'rounded-full bg-info/10 px-2 py-0.5 text-info')}>
                            {upcoming.includes(appt) ? 'Upcoming' : appt.status.replace(/-/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </DrawerSection>

                {/* ── Details ── */}
                <DrawerSection icon={RiUserLine} title="Details">
                  <DrawerRow label="Born" value={patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'} />
                  {patient.email && <DrawerRow label="Email" value={patient.email} />}
                  {address && <DrawerRow label="Address" value={address} />}
                  {patient.emergency_contact?.name && (
                    <DrawerRow
                      label="Emergency"
                      value={`${patient.emergency_contact.name}${patient.emergency_contact.relationship ? ` (${patient.emergency_contact.relationship})` : ''} · ${patient.emergency_contact.phone}`}
                    />
                  )}
                  {patient.insurance?.provider && (
                    <DrawerRow label="Insurance" value={[patient.insurance.provider, patient.insurance.policy_number].filter(Boolean).join(' · ')} />
                  )}
                  <DrawerRow label="Patient since" value={formatDate(patient.created_at)} />
                </DrawerSection>

                {(patient.medical_history?.chronic_conditions?.length || patient.medical_history?.current_medications?.length || patient.medical_history?.family_history || patient.notes) && (
                  <DrawerSection icon={RiHeartPulseLine} title="Health & notes">
                    {!!patient.medical_history?.chronic_conditions?.length && (
                      <DrawerRow label="Conditions" value={patient.medical_history.chronic_conditions.join(', ')} />
                    )}
                    {!!patient.medical_history?.current_medications?.length && (
                      <DrawerRow label="Medication" value={patient.medical_history.current_medications.join(', ')} />
                    )}
                    {patient.medical_history?.family_history && <DrawerRow label="Family history" value={patient.medical_history.family_history} />}
                    {patient.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{patient.notes}</p>}
                  </DrawerSection>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {patient && (
          <div className="flex flex-shrink-0 flex-col gap-2 border-t bg-background px-5 py-3">
            <Button className="w-full gap-2 font-semibold" onClick={() => actions.onNewOrder(patient)}>
              <RiReceiptLine className="size-4" />
              New sales order
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => actions.onBookAppointment(patient)}>
                <RiCalendarLine className="size-4" />
                Book appointment
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => actions.onEdit(patient)}>
                <RiEdit2Line className="size-4" />
                Edit
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5" aria-label="More patient actions">
                    <RiMore2Line className="size-4" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-52">
                  <DropdownMenuItem onClick={() => actions.onNewPrescription(patient)}>
                    <RiFileTextLine className="size-4" />
                    New prescription
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDelete(patient)}>
                    <RiDeleteBin6Line className="size-4" />
                    Delete patient
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
