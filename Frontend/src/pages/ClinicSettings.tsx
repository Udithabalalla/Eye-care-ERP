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
        default_ship_to_location: data.default_ship_to_location,
        default_delivery_address: data.default_delivery_address,
        default_receiving_department: data.default_receiving_department,
        default_delivery_instructions: data.default_delivery_instructions,
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
    if (!form.default_ship_to_location?.trim()) {
      toast.error('Default ship to location is required')
      return
    }
    if (!form.default_delivery_address?.trim()) {
      toast.error('Default delivery address is required')
      return
    }
    if (!form.default_receiving_department?.trim()) {
      toast.error('Default receiving department is required')
      return
    }

    saveMutation.mutate({
      company_name: form.company_name,
      company_logo: form.company_logo || 'Logo.png',
      address: form.address,
      phone: form.phone,
      email: form.email,
      tax_number: form.tax_number,
      default_ship_to_location: form.default_ship_to_location?.trim(),
      default_delivery_address: form.default_delivery_address?.trim(),
      default_receiving_department: form.default_receiving_department?.trim(),
      default_delivery_instructions: form.default_delivery_instructions?.trim(),
    })
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Company Profile</h1>
        <p className="mt-1 text-[17px] text-secondary">
          Configure the company header and shipping defaults used across purchase orders.
        </p>
      </div>

      <div className="rounded-apple-lg border border-border bg-bg-primary p-6 shadow-xs">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <Input
            label="* Default Ship To Location"
            value={form.default_ship_to_location || ''}
            onChange={(e) => setForm({ ...form, default_ship_to_location: e.target.value })}
            placeholder="Main Warehouse"
          />
          <Input
            label="* Default Delivery Address"
            value={form.default_delivery_address || ''}
            onChange={(e) => setForm({ ...form, default_delivery_address: e.target.value })}
            placeholder="No. 120, Galle Road, Colombo 03"
          />
          <Input
            label="* Default Receiving Department"
            value={form.default_receiving_department || ''}
            onChange={(e) => setForm({ ...form, default_receiving_department: e.target.value })}
            placeholder="Stores / Procurement"
          />
          <Input
            label="Default Delivery Instructions"
            value={form.default_delivery_instructions || ''}
            onChange={(e) => setForm({ ...form, default_delivery_instructions: e.target.value })}
            placeholder="Deliver between 9:00 AM - 5:00 PM"
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
            default_ship_to_location: data.default_ship_to_location,
            default_delivery_address: data.default_delivery_address,
            default_receiving_department: data.default_receiving_department,
            default_delivery_instructions: data.default_delivery_instructions,
          } : {})}>Reset</Button>
        </div>
      </div>

      <div className="rounded-apple-lg border border-border bg-bg-secondary/60 p-6">
        <h2 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Preview</h2>
        <div className="mt-4 grid gap-2 text-sm text-secondary">
          <p><span className="font-medium text-primary">Company:</span> {form.company_name || '-'}</p>
          <p><span className="font-medium text-primary">Address:</span> {form.address || '-'}</p>
          <p><span className="font-medium text-primary">Phone:</span> {form.phone || '-'}</p>
          <p><span className="font-medium text-primary">Email:</span> {form.email || '-'}</p>
          <p><span className="font-medium text-primary">Tax Number:</span> {form.tax_number || '-'}</p>
          <p><span className="font-medium text-primary">Default Ship To:</span> {form.default_ship_to_location || '-'}</p>
          <p><span className="font-medium text-primary">Default Delivery Address:</span> {form.default_delivery_address || '-'}</p>
          <p><span className="font-medium text-primary">Default Receiving Department:</span> {form.default_receiving_department || '-'}</p>
          <p><span className="font-medium text-primary">Default Delivery Instructions:</span> {form.default_delivery_instructions || '-'}</p>
        </div>
      </div>
    </div>
  )
}

export default ClinicSettings
