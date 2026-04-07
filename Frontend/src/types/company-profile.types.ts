export interface CompanyProfile {
  id?: string
  company_name?: string
  company_logo?: string
  address?: string
  phone?: string
  email?: string
  tax_number?: string
  created_at?: string
  updated_at?: string
}

export interface CompanyProfileFormData {
  company_name?: string
  company_logo?: string
  address?: string
  phone?: string
  email?: string
  tax_number?: string
}
