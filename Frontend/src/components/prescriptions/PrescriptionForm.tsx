import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, format } from 'date-fns'
import { toast } from 'react-hot-toast'
import {
  RiAddLine,
  RiArrowDownLine,
  RiDeleteBinLine,
  RiHistoryLine,
  RiUserLine,
} from '@remixicon/react'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { patientsApi } from '@/api/patients.api'
import { EyeMeasurement, Prescription, PrescriptionFormData } from '@/types/prescription.types'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { usePractitioners, isSamePerson } from '@/hooks/usePractitioners'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/formatters'
import { apiErrorMessage, cn } from '@/utils/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PRESCRIPTION_TYPES, eyeSummary } from './rxFormat'

// ── Schema: numbers are typed as text and converted on save ────────────────
const numberText = z.string().refine((v) => v.trim() === '' || !Number.isNaN(Number(v)), 'Not a number')

const eyeSchema = z
  .object({
    sphere: numberText,
    cylinder: numberText,
    axis: z.string().refine((v) => v.trim() === '' || (/^\d{1,3}$/.test(v.trim()) && Number(v) <= 180), '0–180'),
    add: numberText,
    pupillary_distance: numberText,
  })
  .superRefine((eye, ctx) => {
    if (eye.cylinder.trim() && Number(eye.cylinder) !== 0 && !eye.axis.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['axis'], message: 'Needed with CYL' })
    }
  })

const prescriptionSchema = z
  .object({
    patient_id: z.string().min(1, 'Choose a patient'),
    doctor_id: z.string().min(1, 'Choose who examined the patient'),
    prescription_date: z.string().min(1, 'Enter the date'),
    valid_until: z.string().min(1, 'Choose how long it is valid'),
    diagnosis: z.string().trim().min(5, 'Describe the diagnosis (at least 5 characters)'),
    has_eye_rx: z.boolean(),
    prescription_type: z.enum(['single-vision', 'bifocal', 'progressive']),
    right_eye: eyeSchema,
    left_eye: eyeSchema,
    medications: z.array(
      z.object({
        medication_name: z.string().trim().min(1, 'Name the medication'),
        dosage: z.string(),
        frequency: z.string(),
        duration: z.string(),
        instructions: z.string(),
        quantity: z.coerce.number().int().min(1, 'At least 1'),
      }),
    ),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.has_eye_rx && !values.right_eye.sphere.trim() && !values.left_eye.sphere.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['right_eye', 'sphere'], message: 'Enter SPH for at least one eye' })
    }
  })

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>
type EyeText = PrescriptionFormValues['right_eye']

const toText = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v))
const eyeToText = (eye?: EyeMeasurement): EyeText => ({
  sphere: toText(eye?.sphere),
  cylinder: toText(eye?.cylinder),
  axis: toText(eye?.axis),
  add: toText(eye?.add),
  pupillary_distance: toText(eye?.pupillary_distance),
})
const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))
const eyeToNumbers = (eye: EyeText): EyeMeasurement => ({
  sphere: toNumber(eye.sphere),
  cylinder: toNumber(eye.cylinder),
  axis: toNumber(eye.axis),
  add: toNumber(eye.add),
  pupillary_distance: toNumber(eye.pupillary_distance),
})

const DIAGNOSES = ['Myopia', 'Hyperopia', 'Astigmatism', 'Presbyopia', 'Normal vision']
const VALIDITY = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
]
const EYE_FIELDS = [
  { key: 'sphere', label: 'SPH', step: '0.25', placeholder: '0.00' },
  { key: 'cylinder', label: 'CYL', step: '0.25', placeholder: '0.00' },
  { key: 'axis', label: 'AXIS', step: '1', placeholder: '0–180' },
  { key: 'add', label: 'ADD', step: '0.25', placeholder: '+0.00' },
  { key: 'pupillary_distance', label: 'PD', step: '0.5', placeholder: 'mm' },
] as const

const plusMonths = (dateKey: string, months: number) =>
  format(addMonths(new Date(`${dateKey}T00:00:00`), months), 'yyyy-MM-dd')

interface PrescriptionFormProps {
  prescription?: Prescription | null
  onSuccess: () => void
  onCancel: () => void
  /** Open a different prescription (e.g. the patient's last one) */
  onSwitchToEdit?: (prescription: Prescription) => void
  initialPatientId?: string
  initialDoctorId?: string
  initialDoctorName?: string
  initialAppointmentId?: string
}

const PrescriptionForm = ({
  prescription,
  onSuccess,
  onCancel,
  onSwitchToEdit,
  initialPatientId,
  initialDoctorId,
  initialDoctorName,
  initialAppointmentId,
}: PrescriptionFormProps) => {
  const queryClient = useQueryClient()
  const { user, isDoctor } = useAuth()
  const isEdit = !!prescription
  const { practitioners } = usePractitioners()
  const today = format(new Date(), 'yyyy-MM-dd')

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patient_id: prescription?.patient_id || initialPatientId || '',
      doctor_id: prescription?.doctor_id || initialDoctorId || '',
      prescription_date: prescription?.prescription_date?.split('T')[0] || today,
      valid_until: prescription?.valid_until?.split('T')[0] || plusMonths(today, 12),
      diagnosis: prescription?.diagnosis || '',
      has_eye_rx: prescription ? !!prescription.eye_prescription : true,
      prescription_type: prescription?.eye_prescription?.prescription_type || 'single-vision',
      right_eye: eyeToText(prescription?.eye_prescription?.right_eye),
      left_eye: eyeToText(prescription?.eye_prescription?.left_eye),
      medications: (prescription?.medications || []).map((m) => ({ ...m, quantity: m.quantity || 1 })),
      notes: prescription?.notes || '',
    },
  })
  const medications = useFieldArray({ control: form.control, name: 'medications' })

  const patientId = form.watch('patient_id')
  const hasEyeRx = form.watch('has_eye_rx')
  const rxType = form.watch('prescription_type')
  const prescriptionDate = form.watch('prescription_date')
  const validUntil = form.watch('valid_until')
  const diagnosis = form.watch('diagnosis')

  // Default prescriber: the signed-in doctor, else the only one on staff
  useEffect(() => {
    if (isEdit || form.getValues('doctor_id') || practitioners.length === 0) return
    const me =
      isDoctor && user
        ? practitioners.find((p) => p.id === user.user_id || (p.doctor && isSamePerson(p.doctor, user)))
        : undefined
    const pick = me ?? (practitioners.length === 1 ? practitioners[0] : undefined)
    if (pick) form.setValue('doctor_id', pick.id)
  }, [practitioners, isDoctor, user, isEdit, form])

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

  const doctorOptions = useMemo<LOVOption[]>(() => {
    const options = practitioners.map((p) => ({ value: p.id, label: p.name, subtitle: p.title }))
    // Keep a prescriber who is no longer on the list (e.g. from an older record) selectable
    const keep = prescription
      ? { value: prescription.doctor_id, label: prescription.doctor_name }
      : initialDoctorId
        ? { value: initialDoctorId, label: initialDoctorName || 'Doctor from the appointment' }
        : undefined
    if (keep && !options.some((o) => o.value === keep.value)) options.unshift({ ...keep, subtitle: '' })
    return options
  }, [practitioners, prescription, initialDoctorId, initialDoctorName])

  // ── The patient's previous prescription, to start from ───────────────────
  const { data: lastRx } = useQuery({
    queryKey: ['prescriptions', 'latest', patientId],
    queryFn: async () => (await prescriptionsApi.getAll({ patient_id: patientId, page_size: 1 })).data[0] ?? null,
    enabled: !!patientId && !isEdit,
  })
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null)

  const copyLast = () => {
    if (!lastRx) return
    if (lastRx.eye_prescription) {
      form.setValue('has_eye_rx', true)
      form.setValue('prescription_type', lastRx.eye_prescription.prescription_type)
      form.setValue('right_eye', eyeToText(lastRx.eye_prescription.right_eye))
      form.setValue('left_eye', eyeToText(lastRx.eye_prescription.left_eye))
    }
    if (!form.getValues('diagnosis').trim()) form.setValue('diagnosis', lastRx.diagnosis)
    setCopiedFrom(lastRx.prescription_id)
  }

  const copyRightToLeft = () => {
    form.setValue('left_eye', { ...form.getValues('right_eye') }, { shouldValidate: true })
  }

  const addDiagnosis = (term: string) => {
    const current = form.getValues('diagnosis').trim()
    if (!current) form.setValue('diagnosis', term, { shouldValidate: true })
    else if (!current.toLowerCase().includes(term.toLowerCase())) form.setValue('diagnosis', `${current}, ${term.toLowerCase()}`, { shouldValidate: true })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const onDone = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
    toast.success(message)
    onSuccess()
  }
  const createMutation = useMutation({
    mutationFn: prescriptionsApi.create,
    onSuccess: () => onDone('Prescription saved'),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not save the prescription')),
  })
  const updateMutation = useMutation({
    mutationFn: (data: Partial<PrescriptionFormData>) => prescriptionsApi.update(prescription!.prescription_id, data),
    onSuccess: () => onDone('Prescription updated'),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the prescription')),
  })

  const onSubmit = (values: PrescriptionFormValues) => {
    const payload: PrescriptionFormData = {
      patient_id: values.patient_id,
      doctor_id: values.doctor_id,
      prescription_date: values.prescription_date,
      valid_until: values.valid_until,
      diagnosis: values.diagnosis.trim(),
      notes: values.notes?.trim() || undefined,
      // null clears an eye prescription that was removed while editing
      eye_prescription: values.has_eye_rx
        ? {
            prescription_type: values.prescription_type,
            right_eye: eyeToNumbers(values.right_eye),
            left_eye: eyeToNumbers({ ...values.left_eye, add: values.prescription_type === 'single-vision' ? '' : values.left_eye.add }),
          }
        : null,
      medications: values.medications,
      appointment_id: prescription?.appointment_id || initialAppointmentId,
    }
    if (payload.eye_prescription && values.prescription_type === 'single-vision') payload.eye_prescription.right_eye.add = null

    if (isEdit) {
      // The patient and the visit it came from stay as recorded
      const changes: Partial<PrescriptionFormData> = { ...payload }
      delete changes.patient_id
      delete changes.appointment_id
      updateMutation.mutate(changes)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const showAdd = rxType !== 'single-vision'
  const eyeFields = EYE_FIELDS.filter((f) => f.key !== 'add' || showAdd)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Who and when ─────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">
          {isEdit ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Patient</p>
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
                <RiUserLine className="size-4 text-muted-foreground" />
                <span className="truncate">{prescription!.patient_name}</span>
              </div>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <SearchableLOV
                      label="Patient"
                      required
                      value={field.value ?? ''}
                      onChange={(v) => { setCopiedFrom(null); field.onChange(v) }}
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
          <FormField
            control={form.control}
            name="doctor_id"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <SearchableLOV
                    label="Examined by"
                    required
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={doctorOptions}
                    placeholder="Choose doctor or optometrist"
                    error={fieldState.error?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="prescription_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Date of exam</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    max={today}
                    {...field}
                    onChange={(e) => {
                      // Keep the same validity length when the exam date moves
                      const months = VALIDITY.find((v) => plusMonths(field.value ?? today, v.months) === validUntil)?.months
                      field.onChange(e.target.value)
                      if (months && e.target.value) form.setValue('valid_until', plusMonths(e.target.value, months))
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {lastRx && !isEdit && (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-sm">
              <RiHistoryLine className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">
                  Last prescription {formatDate(lastRx.prescription_date, 'd MMM yyyy')} · {lastRx.doctor_name}
                </p>
                {lastRx.eye_prescription && (
                  <p className="text-muted-foreground tabular-nums">
                    R {eyeSummary(lastRx.eye_prescription.right_eye)} · L {eyeSummary(lastRx.eye_prescription.left_eye)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {onSwitchToEdit && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onSwitchToEdit(lastRx)}>
                  View it
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={copyLast} disabled={copiedFrom === lastRx.prescription_id}>
                {copiedFrom === lastRx.prescription_id ? 'Values copied' : 'Start from these values'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Glasses prescription ─────────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Glasses prescription</h3>
              <p className="text-xs text-muted-foreground">Leave a box empty if it doesn't apply.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={hasEyeRx} onCheckedChange={(v) => form.setValue('has_eye_rx', v === true)} />
              Include glasses prescription
            </label>
          </div>

          {hasEyeRx && (
            <>
              <div className="flex flex-wrap gap-2">
                {PRESCRIPTION_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    size="sm"
                    variant={rxType === t.value ? 'default' : 'outline'}
                    onClick={() => form.setValue('prescription_type', t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-separate border-spacing-x-2 border-spacing-y-1.5">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="w-16 text-left font-medium" />
                      {eyeFields.map((f) => (
                        <th key={f.key} className="text-left font-medium">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['right_eye', 'left_eye'] as const).map((eye) => (
                      <tr key={eye}>
                        <td className="align-top pt-2 text-sm font-semibold">
                          {eye === 'right_eye' ? 'Right' : 'Left'}
                          <span className="block text-[11px] font-normal text-muted-foreground">{eye === 'right_eye' ? 'OD' : 'OS'}</span>
                        </td>
                        {eyeFields.map((f) => (
                          <td key={f.key} className="align-top">
                            <FormField
                              control={form.control}
                              name={`${eye}.${f.key}`}
                              render={({ field, fieldState }) => (
                                <FormItem className="gap-1">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      step={f.step}
                                      placeholder={f.placeholder}
                                      aria-label={`${eye === 'right_eye' ? 'Right' : 'Left'} ${f.label}`}
                                      className={cn('tabular-nums', fieldState.error && 'border-destructive')}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-[11px]" />
                                </FormItem>
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={copyRightToLeft}>
                <RiArrowDownLine />
                Copy right eye to left
              </Button>
            </>
          )}
        </section>

        {/* ── Diagnosis and validity ───────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diagnosis <span className="text-destructive">*</span></FormLabel>
                <div className="flex flex-wrap gap-1.5">
                  {DIAGNOSES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => addDiagnosis(d)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        diagnosis.toLowerCase().includes(d.toLowerCase())
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <FormControl>
                  <Textarea rows={2} placeholder="e.g. Myopia with astigmatism, both eyes" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="valid_until"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid for</FormLabel>
                <div className="flex gap-1.5">
                  {VALIDITY.map((v) => {
                    const until = plusMonths(prescriptionDate || today, v.months)
                    return (
                      <Button
                        key={v.months}
                        type="button"
                        size="sm"
                        variant={field.value === until ? 'default' : 'outline'}
                        onClick={() => field.onChange(until)}
                      >
                        {v.label}
                      </Button>
                    )
                  })}
                </div>
                <FormControl>
                  <Input type="date" min={prescriptionDate} className="w-full md:w-48" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Medications ──────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Medications <span className="font-normal text-muted-foreground">(optional)</span>
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => medications.append({ medication_name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: 1 })}
            >
              <RiAddLine />
              Add medication
            </Button>
          </div>
          {medications.fields.map((row, index) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-6">
              <FormField
                control={form.control}
                name={`medications.${index}.medication_name`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormControl><Input placeholder="Medication, e.g. Eye drops" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(['dosage', 'frequency', 'duration'] as const).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`medications.${index}.${key}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder={key === 'dosage' ? '1 drop' : key === 'frequency' ? '3× daily' : '7 days'} aria-label={key} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`medications.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl><Input type="number" min={1} aria-label="Quantity" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Remove medication" onClick={() => medications.remove(index)}>
                  <RiDeleteBinLine />
                </Button>
              </div>
              <FormField
                control={form.control}
                name={`medications.${index}.instructions`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-6">
                    <FormControl><Input placeholder="Instructions (optional), e.g. before sleep" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </section>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Advice given, lens recommendations…" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save prescription'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default PrescriptionForm
