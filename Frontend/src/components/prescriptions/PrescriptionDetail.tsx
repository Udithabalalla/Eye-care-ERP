import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RiDownloadLine, RiEditLine } from '@remixicon/react'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'
import { cn, downloadFile } from '@/utils/helpers'
import { Button } from '@/components/ui/button'
import { EyeRxTable } from './EyeRxTable'
import { VALIDITY_CLASS, prescriptionTypeLabel, validityOf } from './rxFormat'

interface PrescriptionDetailProps {
  prescription: Prescription
  onClose: () => void
  /** Hidden when the prescription is shown for reference only */
  onEdit?: () => void
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="mt-0.5 text-sm text-foreground">{children}</div>
  </div>
)

/** Everything about one prescription, laid out the way it is read */
const PrescriptionDetail = ({ prescription: rx, onClose, onEdit }: PrescriptionDetailProps) => {
  const validity = validityOf(rx)

  const download = async () => {
    try {
      downloadFile(await prescriptionsApi.downloadPDF(rx.prescription_id), `prescription-${rx.prescription_id}.pdf`)
    } catch {
      toast.error('Could not download the PDF')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={`/patients?detail=${rx.patient_id}`} className="text-lg font-semibold hover:text-primary hover:underline">
            {rx.patient_name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {rx.prescription_id} · {formatDate(rx.prescription_date, 'd MMM yyyy')} · {rx.doctor_name}
          </p>
        </div>
        <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium', VALIDITY_CLASS[validity.tone])}>
          {validity.label} · until {formatDate(rx.valid_until, 'd MMM yyyy')}
        </span>
      </div>

      <Field label="Diagnosis">{rx.diagnosis}</Field>

      {rx.eye_prescription ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Glasses prescription · {prescriptionTypeLabel(rx.eye_prescription.prescription_type)}
          </p>
          <EyeRxTable rx={rx.eye_prescription} size="md" />
        </div>
      ) : (
        <Field label="Glasses prescription"><span className="text-muted-foreground">None recorded</span></Field>
      )}

      {rx.contact_lenses && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Contact lenses · replace {rx.contact_lenses.replacement_schedule}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['right_eye', 'left_eye'] as const).map((eye) => (
              <div key={eye} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="font-medium">{eye === 'right_eye' ? 'Right' : 'Left'} · {rx.contact_lenses![eye].brand}</p>
                <p className="text-muted-foreground">
                  Power {rx.contact_lenses![eye].power} · BC {rx.contact_lenses![eye].base_curve} · DIA {rx.contact_lenses![eye].diameter}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {rx.medications?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Medications</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rx.medications.map((med, i) => (
              <li key={i} className="px-3 py-2.5 text-sm">
                <p className="font-medium">
                  {med.medication_name}
                  {med.quantity ? <span className="font-normal text-muted-foreground"> × {med.quantity}</span> : null}
                </p>
                <p className="text-muted-foreground">
                  {[med.dosage, med.frequency, med.duration && `for ${med.duration}`].filter(Boolean).join(', ')}
                </p>
                {med.instructions && <p className="text-xs text-muted-foreground">{med.instructions}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rx.notes && <Field label="Notes">{rx.notes}</Field>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button variant="outline" onClick={download}>
          <RiDownloadLine />
          Download PDF
        </Button>
        {onEdit && (
          <Button onClick={onEdit}>
            <RiEditLine />
            Edit
          </Button>
        )}
      </div>
    </div>
  )
}

export default PrescriptionDetail
