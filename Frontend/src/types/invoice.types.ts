import { PaymentStatus, PaymentMethod } from './common.types'

export interface InvoiceItem {
  product_id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  total: number
}

export interface Invoice {
  invoice_id: string
  invoice_number: string
  patient_id: string
  patient_name: string
  patient_phone: string
  patient_email?: string
  invoice_date: string
  due_date: string
  items: InvoiceItem[]
  subtotal: number
  total_discount: number
  total_tax: number
  total_amount: number
  paid_amount: number
  balance_due: number
  payment_status: PaymentStatus
  payment_method?: PaymentMethod
  payment_date?: string
  transaction_id?: string
  prescription_id?: string
  created_by: string
  created_at: string
  updated_at: string
  notes?: string
}

export interface InvoiceFormData {
  patient_id: string
  invoice_date: string
  due_date: string
  items: InvoiceItem[]
  prescription_id?: string
  notes?: string
}
