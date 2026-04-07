import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import { companyProfileApi } from '@/api/company-profile.api'
import type { CompanyProfileFormData } from '@/types/company-profile.types'

const ClinicSettings = () => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CompanyProfileFormData>({})

  const { data } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
  })

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name,
        company_logo: data.company_logo || 'Logo.png',
        address: data.address,
        phone: data.phone,
        email: data.email,
        tax_number: data.tax_number,
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload: CompanyProfileFormData) => companyProfileApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] })
      toast.success('Company profile saved')
    },
    onError: () => toast.error('Failed to save company profile'),
  })

  const handleSave = () => {
    saveMutation.mutate({
      company_name: form.company_name,
      company_logo: form.company_logo || 'Logo.png',
      address: form.address,
      phone: form.phone,
      email: form.email,
      tax_number: form.tax_number,
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Company Profile</h1>
        <p className="text-sm text-secondary mt-1">
          Configure the company header used in purchase order PDFs.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-primary p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            value={form.company_name || ''}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            placeholder="Vision Care Optical Clinic"
          />
          <Input
            label="Logo File"
            value={form.company_logo || 'Logo.png'}
            onChange={(e) => setForm({ ...form, company_logo: e.target.value })}
            placeholder="Logo.png"
          />
          <Input
            label="Address"
            value={form.address || ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="No. 120, Galle Road, Colombo 03"
          />
          <Input
            label="Phone"
            value={form.phone || ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+94 11 2345678"
          />
          <Input
            label="Email"
            type="email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="procurement@visioncare.lk"
          />
          <Input
            label="Tax Number"
            value={form.tax_number || ''}
            onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
            placeholder="TIN-10928374"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleSave}>Save Settings</Button>
          <Button variant="outline" onClick={() => setForm(data ? {
            company_name: data.company_name,
            company_logo: data.company_logo || 'Logo.png',
            address: data.address,
            phone: data.phone,
            email: data.email,
            tax_number: data.tax_number,
          } : {})}>Reset</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-tertiary/30 p-6">
        <h2 className="text-base font-semibold text-primary">Preview</h2>
        <div className="mt-4 grid gap-2 text-sm text-secondary">
          <p><span className="font-medium text-primary">Company:</span> {form.company_name || '-'}</p>
          <p><span className="font-medium text-primary">Address:</span> {form.address || '-'}</p>
          <p><span className="font-medium text-primary">Phone:</span> {form.phone || '-'}</p>
          <p><span className="font-medium text-primary">Email:</span> {form.email || '-'}</p>
          <p><span className="font-medium text-primary">Tax Number:</span> {form.tax_number || '-'}</p>
        </div>
      </div>
    </div>
  )
}

export default ClinicSettings
