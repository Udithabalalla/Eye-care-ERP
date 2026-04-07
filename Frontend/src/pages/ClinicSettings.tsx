import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import { clearBuyerInformation, getSavedBuyerInformation, saveBuyerInformation } from '@/utils/poSettings'
import type { BuyerInformation } from '@/types/supplier.types'

const ClinicSettings = () => {
  const [form, setForm] = useState<BuyerInformation>({
    company_name: '',
    company_logo: 'Logo.png',
    company_address: '',
    phone: '',
    email: '',
    tax_number: '',
  })

  useEffect(() => {
    setForm(getSavedBuyerInformation())
  }, [])

  const handleSave = () => {
    saveBuyerInformation(form)
    toast.success('Clinic header settings saved')
  }

  const handleReset = () => {
    clearBuyerInformation()
    const defaults = getSavedBuyerInformation()
    setForm(defaults)
    toast.success('Clinic header settings reset')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-primary">PO Header Settings</h1>
        <p className="text-sm text-secondary mt-1">
          Configure the buyer identity used in purchase order PDFs.
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
            label="Company Address"
            value={form.company_address || ''}
            onChange={(e) => setForm({ ...form, company_address: e.target.value })}
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
          <Button variant="outline" onClick={handleReset}>Reset</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-tertiary/30 p-6">
        <h2 className="text-base font-semibold text-primary">Preview</h2>
        <div className="mt-4 grid gap-2 text-sm text-secondary">
          <p><span className="font-medium text-primary">Company:</span> {form.company_name || '-'}</p>
          <p><span className="font-medium text-primary">Address:</span> {form.company_address || '-'}</p>
          <p><span className="font-medium text-primary">Phone:</span> {form.phone || '-'}</p>
          <p><span className="font-medium text-primary">Email:</span> {form.email || '-'}</p>
          <p><span className="font-medium text-primary">Tax Number:</span> {form.tax_number || '-'}</p>
        </div>
      </div>
    </div>
  )
}

export default ClinicSettings
