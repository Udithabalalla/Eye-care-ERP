import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { appointmentsApi } from '@/api/appointments.api'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import type { Patient } from '@/types/patient.types'
import type { Invoice } from '@/types/invoice.types'
import type { Appointment } from '@/types/appointment.types'
import type { Prescription } from '@/types/prescription.types'
import { formatDate, formatPhone } from '@/utils/formatters'
import { RiFileTextLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react'
import { cn } from '@/utils/helpers'
import InvoiceHistoryTable from './InvoiceHistoryTable'
import SchedulingHistoryTable from './SchedulingHistoryTable'

interface PatientDetailsDialogProps {
  isOpen: boolean
  patientId: string | null
  initialPatient?: Patient | null
  onClose: () => void
}

const formatAddress = (patient: Patient | null): string => {
  if (!patient?.address) return '—'

  const parts = [
    patient.address.street,
    patient.address.city,
    patient.address.state,
    patient.address.zip_code,
    patient.address.country,
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : '—'
}

const getLatestByDate = <T extends { created_at?: string }>(items: T[], dateKey: keyof T): T | null => {
  if (!items.length) return null

  return [...items].sort((left, right) => {
    const leftValue = new Date(String(left[dateKey] || left.created_at || '')).getTime()
    const rightValue = new Date(String(right[dateKey] || right.created_at || '')).getTime()
    return rightValue - leftValue
  })[0]
}

const PatientDetailsDialog = ({ isOpen, patientId, initialPatient, onClose }: PatientDetailsDialogProps) => {
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(initialPatient ?? null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false)
      setError(null)
      setIsLoading(false)
      return
    }

    if (!patientId) return

    let isActive = true

    setPatient(initialPatient ?? null)
    setInvoices([])
    setAppointments([])
    setPrescriptions([])

    const loadPatientDetails = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [patientResponse, invoiceResponse, appointmentResponse, prescriptionResponse] = await Promise.all([
          patientsApi.getById(patientId),
          invoicesApi.getByPatientId(patientId, { page_size: 100 }),
          appointmentsApi.getByPatientId(patientId, { page_size: 100 }),
          prescriptionsApi.getByPatientId(patientId, { page_size: 100 }),
        ])

        if (!isActive) return

        setPatient(patientResponse)
        setInvoices(invoiceResponse.data)
        setAppointments(appointmentResponse.data)
        setPrescriptions(prescriptionResponse.data)
      } catch {
        if (!isActive) return
        setError('Unable to load patient details.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadPatientDetails()

    return () => {
      isActive = false
    }
  }, [isOpen, patientId])

  const latestInvoice = useMemo(() => getLatestByDate(invoices, 'invoice_date'), [invoices])
  const latestPrescription = useMemo(() => getLatestByDate(prescriptions, 'prescription_date'), [prescriptions])

  const notesText = patient?.notes || latestPrescription?.diagnosis || latestPrescription?.notes || '—'

  const handleNavigateToInvoices = () => {
    if (!latestInvoice) return
    navigate(`/invoices?detail=${latestInvoice.invoice_id}`)
    onClose()
  }

  const handleNavigateToPrescriptions = () => {
    if (!latestPrescription) return
    navigate(`/prescriptions?detail=${latestPrescription.prescription_id}`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[740px] max-h-[calc(100dvh-48px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient?.name || 'Patient Details'}</DialogTitle>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogHeader>

        <div className="space-y-7">
          <section className="space-y-3">
            <h3 className="text-base font-medium text-foreground">General</h3>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="DOB" value={patient ? formatDate(patient.date_of_birth, 'dd/MM/yyyy') : '—'} />
              <Field label="Phone" value={patient ? formatPhone(patient.phone) : '—'} />
              <Field label="Address" value={formatAddress(patient)} />
              <Field label="Gender" value={patient ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—'} />
              <Field label="Email" value={patient?.email || '—'} />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <h3 className="text-base font-medium text-foreground">Notes</h3>
              <div className="rounded-lg bg-muted/40 px-1 py-1">
                <p className="border-l border-border pl-3 text-xs text-muted-foreground">Notes / Diagnoses</p>
                <p className="mt-2 whitespace-pre-line px-3 text-sm leading-6 text-foreground">
                  {isLoading && !patient ? 'Loading notes...' : notesText}
                </p>
              </div>
            </div>

            <div className="space-y-3 lg:col-span-5">
              <h3 className="text-base font-medium text-foreground">Connected Sources</h3>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleNavigateToInvoices}
                  disabled={!latestInvoice}
                  className={cn('w-full justify-start text-sm font-normal', !latestInvoice && 'opacity-60')}
                >
                  <RiFileTextLine className="size-4 shrink-0" />
                  {latestInvoice
                    ? `Latest Invoice - ${formatDate(latestInvoice.invoice_date, 'dd/MM/yyyy')}`
                    : 'Latest Invoice'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNavigateToPrescriptions}
                  disabled={!latestPrescription}
                  className={cn('w-full justify-start text-sm font-normal', !latestPrescription && 'opacity-60')}
                >
                  <RiFileTextLine className="size-4 shrink-0" />
                  {latestPrescription
                    ? `Latest Prescription - ${formatDate(latestPrescription.prescription_date, 'dd/MM/yyyy')}`
                    : 'Latest Prescription'}
                </Button>
              </div>
            </div>
          </section>

          {isExpanded && (
            <>
              <section className="space-y-3">
                <h3 className="text-base font-medium text-foreground">Invoice History</h3>
                <div className="overflow-hidden rounded-xl border border-border">
                  <InvoiceHistoryTable invoices={invoices} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-medium text-foreground">Scheduling History</h3>
                <div className="overflow-hidden rounded-xl border border-border">
                  <SchedulingHistoryTable appointments={appointments} />
                </div>
              </section>
            </>
          )}

          <div className="flex justify-center pt-1">
            <Button
              variant="ghost"
              onClick={() => setIsExpanded((current) => !current)}
              className="text-sm font-medium"
            >
              {isExpanded ? (
                <>Show Less <RiArrowUpSLine className="ml-1 size-4" /></>
              ) : (
                <>Show More <RiArrowDownSLine className="ml-1 size-4" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface FieldProps {
  label: string
  value: string
  className?: string
}

const Field = ({ label, value, className }: FieldProps) => {
  return (
    <div className={cn('border-l border-border pl-3', className)}>
      <p className="text-xs text-muted-foreground">{label} :</p>
      <p className="mt-1 text-sm font-normal text-foreground">{value}</p>
    </div>
  )
}

export default PatientDetailsDialog
