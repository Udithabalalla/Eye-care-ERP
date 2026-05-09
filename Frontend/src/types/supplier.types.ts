export interface Supplier {
  id: string
  supplier_name: string
  company_name?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  payment_terms?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierFormData {
  supplier_name: string
  company_name?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  payment_terms?: string
  notes?: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_cost: number
  line_discount_type?: 'percent' | 'amount'
  line_discount_value?: number
  line_discount_amount?: number
  total_price?: number
}

export interface ReceiveStockSummaryItem {
  product_id: string
  ordered_quantity: number
  received_quantity: number
}

export interface PurchaseOrderReceiptSummary {
  id: string
  received_by: string
  received_at: string
  items: ReceiveStockSummaryItem[]
}

export interface BuyerInformation {
  company_name?: string
  company_logo?: string
  company_address?: string
  phone?: string
  email?: string
  tax_number?: string
}

export interface SupplierInformation {
  supplier_name?: string
  company_name?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  supplier_id?: string
}

export interface ShippingInformation {
  ship_to_location?: string
  delivery_address?: string
  receiving_department?: string
  delivery_instructions?: string
}

export interface PaymentTerms {
  payment_terms?: string
  payment_method?: string
  currency?: string
}

export interface Notes {
  supplier_notes?: string
  internal_notes?: string
}

export interface Authorization {
  approved_by?: string
  signature?: string
  approval_date?: string
}

export interface Footer {
  company_policy_note?: string
  contact_information?: string
}

export interface PurchaseOrderSummary {
  subtotal?: number
  line_discount_total?: number
  tax_rate?: number
  tax_amount?: number
  shipping_cost?: number
  discount?: number
  total_amount?: number
}

export interface PurchaseOrder {
  id: string
  supplier_id: string
  order_date: string
  expected_delivery_date?: string
  status: 'Draft' | 'Approved' | 'Ordered' | 'Received' | 'Closed'
  total_amount: number
  created_by: string
  is_locked?: boolean
  buyer_information?: BuyerInformation
  supplier_information?: SupplierInformation
  shipping_information?: ShippingInformation
  order_summary?: PurchaseOrderSummary
  payment_terms?: PaymentTerms
  notes?: Notes
  authorization?: Authorization
  footer?: Footer
  receipt_summary?: PurchaseOrderReceiptSummary
  items: PurchaseOrderItem[]
  created_at: string
  updated_at: string
}

export interface BuyerInformation {
  company_name?: string
  company_logo?: string
  company_address?: string
  phone?: string
  email?: string
  tax_number?: string
}

export interface PurchaseOrderFormItem {
  product_id: string
  description?: string
  quantity: number
  unit_cost: number
}

export interface PurchaseOrderFormData {
  supplier_id: string
  order_date: string
  expected_delivery_date?: string
  items: PurchaseOrderFormItem[]
  buyer_information?: BuyerInformation
  shipping_information?: ShippingInformation
  summary?: PurchaseOrderSummary
  payment_terms?: PaymentTerms
  notes?: Notes
  authorization?: Authorization
  footer?: Footer
}

export interface PurchaseOrderAssistantItem {
  product_id: string
  description: string
  quantity: number
  unit_cost: number
}

export interface ReceiveGoodsLineItem {
  product_id: string
  product_name: string
  ordered_quantity: number
  received_quantity: number
}

export interface ReceiveStockItem {
  product_id: string
  ordered_quantity: number
  received_quantity: number
}

export interface ReceiveStockFormData {
  items: ReceiveStockItem[]
}

export interface SupplierInvoice {
  id: string
  supplier_id: string
  purchase_order_id?: string
  invoice_number: string
  invoice_date: string
  total_amount: number
  due_date?: string
  status: 'Unpaid' | 'Partial' | 'Paid'
  items?: SupplierInvoiceItem[]
  matching_status?: 'Matched' | 'Flagged'
  matching_issues?: string[]
  created_at: string
  updated_at: string
}

export interface SupplierInvoiceItem {
  product_id: string
  product_name?: string
  ordered_quantity: number
  received_quantity: number
  invoice_quantity: number
  unit_price: number
  line_total: number
  warnings?: string[]
}

export interface SupplierInvoiceFormData {
  supplier_id: string
  purchase_order_id?: string
  invoice_number: string
  invoice_date: string
  total_amount?: number
  due_date?: string
  status?: 'Unpaid' | 'Partial' | 'Paid'
  items?: SupplierInvoiceItem[]
}

export interface SupplierPayment {
  id: string
  invoice_id: string
  payment_date: string
  payment_method: string
  amount_paid: number
  reference_number?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierPaymentFormData {
  invoice_id?: string
  payment_date: string
  payment_method: string
  amount_paid: number
  reference_number?: string
  notes?: string
}
