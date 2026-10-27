import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Doctor, DoctorFormData } from '@/types/doctor.types'
import { cn } from '@/utils/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WEEK } from '@/components/appointments/appointmentUtils'

const SPECIALIZATIONS = ['Ophthalmologist', 'Optometrist', 'Optician', 'Surgeon', 'Consultant', 'Other']
const DAY_PRESETS = [
  { label: 'Mon–Fri', days: WEEK.slice(0, 5) },
  { label: 'Mon–Sat', days: WEEK.slice(0, 6) },
  { label: 'Every day', days: WEEK },
]

const doctorSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the full name'),
    specialization: z.string().min(1, 'Choose a specialization'),
    qualification: z.string().optional(),
    experience_years: z.coerce.number().int().min(0).optional(),
    consultation_fee: z.coerce.number().min(0, 'Cannot be negative'),
    contact_number: z.string().optional(),
    email: z.string().trim().email('Not a valid email').or(z.literal('')).optional(),
    available_days: z.array(z.string()).min(1, 'Pick at least one working day'),
    available_time_start: z.string().min(1, 'Start time'),
    available_time_end: z.string().min(1, 'End time'),
    is_active: z.boolean(),
  })
  .refine((v) => v.available_time_end > v.available_time_start, {
    path: ['available_time_end'],
    message: 'Must be after the start time',
  })

type DoctorFormValues = z.infer<typeof doctorSchema>

interface DoctorFormProps {
  doctor?: Doctor | null
  /** Pre-filled values, e.g. from a staff account with a doctor role */
  prefill?: Partial<DoctorFormData>
  isPending: boolean
  onSubmit: (data: DoctorFormData) => void
  onCancel: () => void
}

const DoctorForm = ({ doctor, prefill, isPending, onSubmit, onCancel }: DoctorFormProps) => {
  const source = doctor ?? prefill
  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      name: source?.name ?? '',
      specialization: source?.specialization ?? 'Ophthalmologist',
      qualification: source?.qualification ?? '',
      experience_years: source?.experience_years ?? 0,
      consultation_fee: source?.consultation_fee ?? 0,
      contact_number: source?.contact_number ?? '',
      email: source?.email ?? '',
      available_days: source?.available_days ?? WEEK.slice(0, 5),
      available_time_start: source?.available_time_start ?? '09:00',
      available_time_end: source?.available_time_end ?? '17:00',
      is_active: doctor?.is_active ?? true,
    },
  })

  const submit = (values: DoctorFormValues) =>
    onSubmit({
      ...values,
      name: values.name.trim(),
      qualification: values.qualification?.trim() || undefined,
      contact_number: values.contact_number?.trim() || undefined,
      email: values.email?.trim() || undefined,
      experience_years: values.experience_years ?? 0,
      // Keep the week in order whatever order the days were clicked
      available_days: WEEK.filter((d) => values.available_days.includes(d)),
    })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Full name</FormLabel>
                <FormControl><Input placeholder="Dr. Nimali Fernando" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Specialization</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="qualification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qualification <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input placeholder="MBBS, MS (Ophth)" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input inputMode="tel" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="consultation_fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Consultation fee</FormLabel>
                <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="experience_years"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Years of experience <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* ── When they see patients ───────────────────────────────────── */}
        <section className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <h3 className="text-sm font-semibold">Working hours</h3>
            <p className="text-xs text-muted-foreground">Bookings offer free times inside these hours.</p>
          </div>
          <FormField
            control={form.control}
            name="available_days"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-wrap items-center gap-1.5">
                  {WEEK.map((day) => {
                    const chosen = field.value ?? []
                    const on = chosen.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(on ? chosen.filter((d) => d !== day) : [...chosen, day])}
                        className={cn(
                          'h-9 w-12 rounded-md border text-sm font-medium transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    )
                  })}
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                  {DAY_PRESETS.map((preset) => (
                    <Button key={preset.label} type="button" variant="ghost" size="sm" onClick={() => field.onChange(preset.days)}>
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap items-start gap-3">
            <FormField
              control={form.control}
              name="available_time_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl><Input type="time" className="w-32" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="available_time_end"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Until</FormLabel>
                  <FormControl><Input type="time" className="w-32" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {doctor && (
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  <span>
                    <span className="block text-sm font-medium">Taking appointments</span>
                    <span className="block text-xs text-muted-foreground">Untick when they leave or take a long break. Past records stay.</span>
                  </span>
                </label>
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : doctor ? 'Save changes' : 'Add doctor'}</Button>
        </div>
      </form>
    </Form>
  )
}

export default DoctorForm
