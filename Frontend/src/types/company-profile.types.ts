/** How customer invoices look on screen, printed and as a PDF (Settings → Invoice Appearance) */
export interface InvoiceAppearance {
  layout: 'classic' | 'split' | 'ledger'
  /** #RRGGBB */
  accent: string
  typeface: 'sans' | 'mono'
  spacing: 'roomy' | 'compact'
  show_logo: boolean
  /** The type, code and "… off" under each item */
  show_line_details: boolean
  /** The discount line; off, the subtotal is shown after the discount */
  show_discount: boolean
  /** Your tax number, and the tax line; off, prices are shown with tax included */
  show_tax: boolean
  show_notes: boolean
  /** Each payment with its date; off, one "Paid" line */
  show_payment_details: boolean
  /** Days a new invoice gives the customer to pay when the order sets no full-payment date (0: on receipt) */
  payment_terms_days: 0 | 7 | 14 | 30 | 45 | 60
}

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
  invoice_appearance?: InvoiceAppearance
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
  invoice_appearance?: Partial<InvoiceAppearance>
}
