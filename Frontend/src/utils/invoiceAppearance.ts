import type { CSSProperties } from 'react'
import type { CompanyProfile, InvoiceAppearance } from '@/types/company-profile.types'

/** The brand teal of the Vision Opticals invoice design (backend: DEFAULT_INVOICE_ACCENT) */
export const DEFAULT_INVOICE_ACCENT = '#1F6378'

export const DEFAULT_INVOICE_APPEARANCE: InvoiceAppearance = {
  layout: 'classic',
  accent: DEFAULT_INVOICE_ACCENT,
  typeface: 'sans',
  spacing: 'roomy',
  show_logo: true,
  show_line_details: true,
  show_discount: true,
  show_tax: true,
  show_notes: true,
  show_payment_details: true,
  payment_terms_days: 0,
}

/** The accent colours offered in Settings (the invoice keeps any #RRGGBB the API holds) */
export const INVOICE_ACCENTS: Array<{ name: string; value: string }> = [
  { name: 'Teal', value: DEFAULT_INVOICE_ACCENT },
  { name: 'Ink', value: '#111827' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Green', value: '#059669' },
  { name: 'Orange', value: '#EA580C' },
]

export const PAYMENT_TERMS: InvoiceAppearance['payment_terms_days'][] = [0, 7, 14, 30, 45, 60]

export const paymentTermsLabel = (days: number) => (days === 0 ? 'On receipt' : `Net ${days}`)

/** The shop's invoice appearance, with the defaults for anything not set */
export const invoiceAppearanceOf = (company?: Pick<CompanyProfile, 'invoice_appearance'>): InvoiceAppearance => ({
  ...DEFAULT_INVOICE_APPEARANCE,
  ...(company?.invoice_appearance ?? {}),
})

/**
 * The accent and its tints as CSS variables for the invoice: rules at a quarter of the
 * colour, the balance box and panels lighter still. The brand teal keeps the balance
 * colour of the original design.
 */
export const invoiceColourVars = (accent: string): CSSProperties => {
  const brand = accent.toUpperCase() === DEFAULT_INVOICE_ACCENT
  const tint = (share: number) => `color-mix(in srgb, ${accent} ${share}%, white)`
  return {
    '--inv-accent': accent,
    '--inv-rule': `color-mix(in srgb, ${accent} 25%, transparent)`,
    '--inv-balance': brand ? '#c8e2ea' : tint(20),
    '--inv-panel': tint(10),
    '--inv-zebra': tint(7),
  } as CSSProperties
}
