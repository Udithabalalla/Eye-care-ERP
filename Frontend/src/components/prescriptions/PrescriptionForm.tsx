import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Prescription, PrescriptionFormData, Medication, EyeMeasurement } from '@/types/prescription.types'
import { toast } from 'react-hot-toast'
import { RiAddLine, RiDeleteBinLine, RiCalendarLine } from '@remixicon/react'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { patientsApi } from '@/api/patients.api'
import { usersApi } from '@/api/users.api'
import { safeDate } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format, parseISO } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PrescriptionFormProps {
  prescription?: Prescription | null
  onSuccess: () => void
  onCancel: () => void
  readOnly?: boolean
  onSwitchToEdit?: (prescription: Prescription) => void
}

const emptyEyeMeasurement = (): EyeMeasurement => ({
  sphere: '',
  cylinder: '',
  axis: '',
  add: '',
  pupillary_distance: '',
})

function DatePickerField({
  label,
  required,
  value,
  onChange,
  disabled,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = value ? parseISO(value) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal h-9',
              !date && 'text-muted-foreground'
            )}
          >
            <RiCalendarLine className="mr-2 h-4 w-4 shrink-0" />
            {date ? format(date, 'PPP') : 'Select date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'))
                setOpen(false)
              }
            }}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

const PrescriptionForm = ({ prescription, onSuccess, onCancel, readOnly = false, onSwitchToEdit }: PrescriptionFormProps) => {
  const [patientSearch, setPatientSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(patientSearch), 300)
    return () => clearTimeout(t)
  }, [patientSearch])

  const { data: patients } = useQuery({
    queryKey: ['patients-list', debouncedSearch],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 50, search: debouncedSearch || undefined }),
  })

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
  })

  const [formData, setFormData] = useState<PrescriptionFormData>(() => {
    try {
      return {
        patient_id: prescription?.patient_id || '',
        doctor_id: prescription?.doctor_id || '',
        prescription_date: safeDate(prescription?.prescription_date),
        diagnosis: prescription?.diagnosis || '',
        notes: prescription?.notes || '',
        eye_prescription: prescription?.eye_prescription || undefined,
        medications: prescription?.medications || [],
        contact_lenses: prescription?.contact_lenses || undefined,
      }
    } catch {
      return {
        patient_id: '',
        doctor_id: '',
        prescription_date: new Date().toISOString().split('T')[0],
        diagnosis: '',
        notes: '',
        eye_prescription: undefined,
        medications: [],
        contact_lenses: undefined,
      }
    }
  })

  const [showEyePrescription, setShowEyePrescription] = useState(!!prescription?.eye_prescription)
  const [existingPrescription, setExistingPrescription] = useState<Prescription | null>(null)

  useEffect(() => {
    const checkExistingPrescription = async () => {
      if (!prescription && formData.patient_id) {
        try {
          const response = await prescriptionsApi.getAll({ patient_id: formData.patient_id, page_size: 1 })
          setExistingPrescription(response.data.length > 0 ? response.data[0] : null)
        } catch {
          // ignore
        }
      }
    }
    const timer = setTimeout(checkExistingPrescription, 500)
    return () => clearTimeout(timer)
  }, [formData.patient_id, prescription])

  const createMutation = useMutation({
    mutationFn: prescriptionsApi.create,
    onSuccess: () => { toast.success('Prescription created successfully'); onSuccess() },
    onError: () => toast.error('Failed to create prescription'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PrescriptionFormData>) =>
      prescriptionsApi.update(prescription!.prescription_id, data),
    onSuccess: () => { toast.success('Prescription updated successfully'); onSuccess() },
    onError: () => toast.error('Failed to update prescription'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = { ...formData, eye_prescription: showEyePrescription ? formData.eye_prescription : undefined }
    if (prescription) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...(formData.medications || []), { medication_name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: 1 }],
    })
  }

  const removeMedication = (index: number) => {
    setFormData({ ...formData, medications: (formData.medications || []).filter((_, i) => i !== index) })
  }

  const updateMedication = (index: number, field: keyof Medication, value: string | number) => {
    const updated = [...(formData.medications || [])]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, medications: updated })
  }

  const updateEyeField = useCallback((
    eye: 'right_eye' | 'left_eye',
    field: keyof EyeMeasurement,
    raw: string
  ) => {
    const parsed = raw === '' ? '' : (field === 'axis' ? parseInt(raw) : parseFloat(raw))
    setFormData((prev) => ({
      ...prev,
      eye_prescription: {
        ...prev.eye_prescription!,
        [eye]: { ...prev.eye_prescription![eye], [field]: parsed },
      },
    }))
  }, [])

  const initializeEyePrescription = () => {
    setFormData({
      ...formData,
      eye_prescription: {
        right_eye: emptyEyeMeasurement(),
        left_eye: emptyEyeMeasurement(),
        prescription_type: 'single-vision',
      },
    })
    setShowEyePrescription(true)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const patientOptions: LOVOption[] = (patients?.data || []).map((p: any) => ({
    value: p.patient_id,
    label: p.name,
    subtitle: p.patient_id,
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {existingPrescription && !prescription && (
        <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Existing Prescription Found</p>
              <p className="text-sm text-muted-foreground">
                This patient already has a prescription from {new Date(existingPrescription.prescription_date).toLocaleDateString()}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => onSwitchToEdit?.(existingPrescription)}>
                Edit Existing
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setExistingPrescription(null)}>
                Create New
              </Button>
            </div>
          </div>
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-5">

        {/* Core info */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">Basic Information</p>
            <p className="text-sm text-muted-foreground mt-0.5">Patient, doctor, and prescription date.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableLOV
              label="Patient"
              required
              value={formData.patient_id}
              onChange={(value) => setFormData({ ...formData, patient_id: value })}
              options={patientOptions}
              placeholder="Select patient"
              disabled={readOnly}
              onSearch={setPatientSearch}
            />
            <SearchableLOV
              label="Doctor"
              required
              value={formData.doctor_id}
              onChange={(value) => setFormData({ ...formData, doctor_id: value })}
              options={(users || []).map((u: any): LOVOption => ({ value: u.user_id, label: u.name, subtitle: u.department || u.role || '' }))}
              placeholder="Select doctor"
              disabled={readOnly}
            />

            <DatePickerField
              label="Prescription Date"
              required
              value={formData.prescription_date}
              onChange={(v) => setFormData({ ...formData, prescription_date: v })}
              disabled={readOnly}
            />

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label>Diagnosis <span className="text-destructive">*</span></Label>
              <Textarea
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                rows={2}
                required
                placeholder="Enter diagnosis..."
              />
            </div>
          </div>
        </div>

        {/* Eye prescription */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Eye Prescription</p>
              <p className="text-sm text-muted-foreground mt-0.5">Optical values for right and left eye.</p>
            </div>
            {!showEyePrescription && !readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={initializeEyePrescription}>
                <RiAddLine className="w-4 h-4 mr-1" /> Add Eye Prescription
              </Button>
            )}
          </div>

          {showEyePrescription && formData.eye_prescription && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label>Prescription Type</Label>
                <Select
                  value={formData.eye_prescription.prescription_type}
                  onValueChange={(v) => setFormData({ ...formData, eye_prescription: { ...formData.eye_prescription!, prescription_type: v as any } })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-vision">Single Vision</SelectItem>
                    <SelectItem value="bifocal">Bifocal</SelectItem>
                    <SelectItem value="progressive">Progressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(['right_eye', 'left_eye'] as const).map((eye) => (
                <div key={eye}>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {eye === 'right_eye' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {(['sphere', 'cylinder', 'axis', 'add'] as const).map((field) => (
                      <div key={field} className="flex flex-col gap-1">
                        <Label className="text-xs capitalize">{field}</Label>
                        <Input
                          type="number"
                          step={field === 'axis' ? '1' : '0.25'}
                          min={field === 'axis' ? '0' : undefined}
                          max={field === 'axis' ? '180' : undefined}
                          value={formData.eye_prescription![eye][field]}
                          onChange={(e) => updateEyeField(eye, field, e.target.value)}
                          placeholder="—"
                          className="text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">PD</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.eye_prescription![eye].pupillary_distance}
                        onChange={(e) => updateEyeField(eye, 'pupillary_distance', e.target.value)}
                        placeholder="—"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medications */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Medications</p>
              <p className="text-sm text-muted-foreground mt-0.5">Prescribed medications and dosages.</p>
            </div>
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                <RiAddLine className="w-4 h-4 mr-1" /> Add Medication
              </Button>
            )}
          </div>

          {formData.medications && formData.medications.length > 0 && (
            <div className="space-y-3">
              {(formData.medications as Medication[]).map((med, index) => (
                <div key={index} className="relative rounded-lg border border-border bg-secondary/30 p-4">
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeMedication(index)}
                    >
                      <RiDeleteBinLine className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-3 gap-3 pr-8">
                    {([
                      { field: 'medication_name' as const, label: 'Medication Name', placeholder: 'e.g., Eye Drops' },
                      { field: 'dosage' as const, label: 'Dosage', placeholder: 'e.g., 1 drop' },
                      { field: 'frequency' as const, label: 'Frequency', placeholder: 'e.g., 3 times daily' },
                      { field: 'duration' as const, label: 'Duration', placeholder: 'e.g., 7 days' },
                      { field: 'instructions' as const, label: 'Instructions', placeholder: 'Special instructions' },
                    ] as const).map(({ field, label, placeholder }) => (
                      <div key={field} className="flex flex-col gap-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="text"
                          value={med[field]}
                          onChange={(e) => updateMedication(index, field, e.target.value)}
                          className="text-sm"
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={med.quantity}
                        onChange={(e) => updateMedication(index, 'quantity', parseInt(e.target.value))}
                        className="text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <Label>Additional Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Any additional notes or instructions..."
          />
        </div>
      </fieldset>

      <Separator />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : prescription ? 'Update Prescription' : 'Create Prescription'}
          </Button>
        )}
      </div>
    </form>
  )
}

export default PrescriptionForm
