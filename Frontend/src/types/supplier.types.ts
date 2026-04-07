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
}

export interface PurchaseOrder {
  id: string
  supplier_id: string
  order_date: string
  expected_delivery_date?: string
  status: 'Draft' | 'Approved' | 'Sent' | 'Received' | 'Closed'
  total_amount: number
  created_by: string
  is_locked?: boolean
  buyer_information?: BuyerInformation
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
  quantity: number
  unit_cost: number
}

export interface PurchaseOrderFormData {
  supplier_id: string
  order_date: string
  expected_delivery_date?: string
  items: PurchaseOrderFormItem[]
  buyer_information?: BuyerInformation
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
  created_at: string
  updated_at: string
}

export interface SupplierInvoiceFormData {
  supplier_id: string
  purchase_order_id?: string
  invoice_number: string
  invoice_date: string
  total_amount: number
  due_date?: string
  status?: 'Unpaid' | 'Partial' | 'Paid'
}

export interface SupplierPayment {
  id: string
  invoice_id: string
  payment_date: string
  payment_method: string
  amount_paid: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierPaymentFormData {
  invoice_id: string
  payment_date: string
  payment_method: string
  amount_paid: number
  notes?: string
}
