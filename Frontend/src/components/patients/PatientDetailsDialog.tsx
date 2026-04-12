import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { Dialog, Modal, ModalOverlay } from '@/components/ui/application/modals/modal'
import { appointmentsApi } from '@/api/appointments.api'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import type { Patient } from '@/types/patient.types'
import type { Invoice } from '@/types/invoice.types'
import type { Appointment } from '@/types/appointment.types'
import type { Prescription } from '@/types/prescription.types'
import { formatDate, formatPhone } from '@/utils/formatters'
import { ChevronDown, ChevronUp, File06 } from '@untitledui/icons'
import { cx } from '@/utils/cx'
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
      } catch (loadError) {
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

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable
      onOpenChange={handleOpenChange}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleOpenChange(false)
        }
      }}
    >
      <Modal className="w-full">
        <Dialog aria-label="Patient details" className="mx-auto w-full max-w-[740px] outline-none">
          <div className="max-h-[calc(100dvh-48px)] w-full overflow-y-auto rounded-[18px] bg-white p-5 text-primary shadow-[0_24px_60px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:p-6">
            <div className="space-y-7">
              <div className="space-y-1">
                <h2 className="text-[22px] font-medium leading-tight text-primary">
                  {patient?.name || 'Patient Details'}
                </h2>
                {error && <p className="text-sm text-error-600">{error}</p>}
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-medium text-primary">General</h3>
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
                  <h3 className="text-base font-medium text-primary">Notes</h3>
                  <div className="rounded-lg bg-primary px-1 py-1">
                    <p className="border-l border-secondary pl-3 text-xs text-tertiary">Notes / Diagnoses</p>
                    <p className="mt-2 whitespace-pre-line px-3 text-sm leading-6 text-primary">
                      {isLoading && !patient ? 'Loading notes...' : notesText}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 lg:col-span-5">
                  <h3 className="text-base font-medium text-primary">Connected Sources</h3>
                  <div className="space-y-3">
                    <Button
                      color="tertiary"
                      onClick={handleNavigateToInvoices}
                      iconLeading={File06}
                      className={cx(
                        'w-full justify-start rounded-lg border border-secondary bg-white px-3 py-2 text-sm font-normal text-brand-secondary shadow-none hover:bg-secondary/50',
                        !latestInvoice && 'pointer-events-none opacity-60'
                      )}
                      isDisabled={!latestInvoice}
                    >
                      {latestInvoice
                        ? `Latest Invoice - ${formatDate(latestInvoice.invoice_date, 'dd/MM/yyyy')}`
                        : 'Latest Invoice'}
                    </Button>
                    <Button
                      color="tertiary"
                      onClick={handleNavigateToPrescriptions}
                      iconLeading={File06}
                      className={cx(
                        'w-full justify-start rounded-lg border border-secondary bg-white px-3 py-2 text-sm font-normal text-brand-secondary shadow-none hover:bg-secondary/50',
                        !latestPrescription && 'pointer-events-none opacity-60'
                      )}
                      isDisabled={!latestPrescription}
                    >
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
                    <h3 className="text-base font-medium text-primary">Invoice History</h3>
                    <div className="overflow-hidden rounded-xl border border-secondary bg-white">
                      <InvoiceHistoryTable invoices={invoices} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-base font-medium text-primary">Scheduling History</h3>
                    <div className="overflow-hidden rounded-xl border border-secondary bg-white">
                      <SchedulingHistoryTable appointments={appointments} />
                    </div>
                  </section>
                </>
              )}

              <div className="flex justify-center pt-1">
                <Button
                  color="tertiary"
                  onClick={() => setIsExpanded((current) => !current)}
                  iconTrailing={isExpanded ? ChevronUp : ChevronDown}
                  className="px-4 text-sm font-medium text-primary"
                >
                  {isExpanded ? 'Show Less' : 'Show More'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

interface FieldProps {
  label: string
  value: string
  className?: string
}

const Field = ({ label, value, className }: FieldProps) => {
  return (
    <div className={cx('border-l border-secondary pl-3', className)}>
      <p className="text-xs text-tertiary">{label} :</p>
      <p className="mt-1 text-sm font-normal text-primary">{value}</p>
    </div>
  )
}

export default PatientDetailsDialog