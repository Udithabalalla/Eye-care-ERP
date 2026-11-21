export interface CompanyProfile {
  id?: string
  company_name?: string
  company_logo?: string
  address?: string
  phone?: string
  email?: string
  tax_number?: string
  default_ship_to_location?: string
  default_delivery_address?: string
  default_receiving_department?: string
  default_delivery_instructions?: string
  /** Printed at the foot of every customer invoice */
  invoice_terms?: string
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
  default_ship_to_location?: string
  default_delivery_address?: string
  default_receiving_department?: string
  default_delivery_instructions?: string
  /** Printed at the foot of every customer invoice */
  invoice_terms?: string
}
