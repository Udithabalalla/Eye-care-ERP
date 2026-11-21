import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { companyProfileApi } from '@/api/company-profile.api'
import type { CompanyProfile, CompanyProfileFormData } from '@/types/company-profile.types'

const profileSchema = z.object({
  company_name: z.string().optional(),
  company_logo: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tax_number: z.string().optional(),
  default_delivery_address: z.string().trim().min(1, 'Default delivery address is required'),
  default_receiving_department: z.string().trim().min(1, 'Default receiving department is required'),
  default_delivery_instructions: z.string().optional(),
  invoice_terms: z.string().max(600, 'Keep it under 600 characters so it fits on the invoice').optional(),
})
type ProfileFormValues = z.infer<typeof profileSchema>

const valuesFrom = (data?: CompanyProfile): ProfileFormValues => ({
  company_name: data?.company_name || '',
  company_logo: data?.company_logo || 'Logo.png',
  address: data?.address || '',
  phone: data?.phone || '',
  email: data?.email || '',
  tax_number: data?.tax_number || '',
  default_delivery_address: data?.default_delivery_address || '',
  default_receiving_department: data?.default_receiving_department || '',
  default_delivery_instructions: data?.default_delivery_instructions || '',
  invoice_terms: data?.invoice_terms || '',
})

const FIELDS: Array<{ name: keyof ProfileFormValues; label: string; placeholder: string; type?: string }> = [
  { name: 'company_name', label: 'Company Name', placeholder: 'Vision Care Optical Clinic' },
  { name: 'company_logo', label: 'Logo File', placeholder: 'Logo.png' },
  { name: 'address', label: 'Address', placeholder: 'No. 120, Galle Road, Colombo 03' },
  { name: 'phone', label: 'Phone', placeholder: '+94 11 2345678' },
  { name: 'email', label: 'Email', placeholder: 'procurement@visioncare.lk', type: 'email' },
  { name: 'tax_number', label: 'Tax Number', placeholder: 'TIN-10928374' },
  { name: 'default_delivery_address', label: '* Default Delivery Address', placeholder: 'No. 120, Galle Road, Colombo 03' },
  { name: 'default_receiving_department', label: '* Default Receiving Department', placeholder: 'Stores / Procurement' },
  { name: 'default_delivery_instructions', label: 'Default Delivery Instructions', placeholder: 'Deliver between 9:00 AM - 5:00 PM' },
]

const PREVIEW: Array<[keyof ProfileFormValues, string]> = [
  ['company_name', 'Company'],
  ['address', 'Address'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['tax_number', 'Tax Number'],
  ['default_delivery_address', 'Default Delivery Address'],
  ['default_receiving_department', 'Default Receiving Department'],
  ['default_delivery_instructions', 'Default Delivery Instructions'],
]

const ClinicSettings = () => {
  const queryClient = useQueryClient()
  const initialized = useRef(false)
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: valuesFrom() })

  const { data } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
  })

  // Fill the form once when the profile first arrives; later refetches don't overwrite edits
  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true
      form.reset(valuesFrom(data))
    }
  }, [data, form])

  const saveMutation = useMutation({
    mutationFn: (payload: CompanyProfileFormData) => companyProfileApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] })
      toast.success('Company profile saved')
    },
    onError: () => toast.error('Failed to save company profile'),
  })

  const save = (values: ProfileFormValues) =>
    saveMutation.mutate({
      company_name: values.company_name,
      company_logo: values.company_logo || 'Logo.png',
      address: values.address,
      phone: values.phone,
      email: values.email,
      tax_number: values.tax_number,
      default_delivery_address: values.default_delivery_address.trim(),
      default_receiving_department: values.default_receiving_department.trim(),
      default_delivery_instructions: values.default_delivery_instructions?.trim(),
      invoice_terms: values.invoice_terms?.trim(),
    })

  const preview = form.watch()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Company Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the company header and shipping defaults used across purchase orders.
        </p>
      </div>

      <Card>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save)}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {FIELDS.map(({ name, label, placeholder, type }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <FormField
                control={form.control}
                name="invoice_terms"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Invoice Terms & Conditions</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="e.g. Please collect your order within 30 days." {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>Printed at the foot of every customer invoice. Leave empty to leave it off.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Spinner />}
                  Save Settings
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset(valuesFrom(data))}>
                  Reset
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          {PREVIEW.map(([name, label]) => (
            <p key={name}>
              <span className="font-medium text-foreground">{label}:</span> {preview[name] || '-'}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default ClinicSettings
