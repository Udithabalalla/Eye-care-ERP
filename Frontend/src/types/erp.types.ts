import { PaymentMethod } from './common.types'

export type SalesOrderStatus = 'draft' | 'confirmed' | 'in_production' | 'ready' | 'completed' | 'cancelled'

export type LedgerTransactionType = 'SALE' | 'PURCHASE' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_PAYMENT' | 'REFUND'

export type LedgerReferenceType = 'INVOICE' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'SUPPLIER_INVOICE' | 'STOCK_ADJUSTMENT'

export type InventoryMovementType = 'PURCHASE_IN' | 'SALE_OUT' | 'ADJUSTMENT' | 'RETURN'

export interface SalesOrderItem {
  product_id: string
  product_name?: string
  sku?: string
  quantity: number
  unit_price: number
  total: number
}

export interface SalesOrderCreatePayload {
  patient_id: string
  prescription_id?: string
  notes?: string
  status: SalesOrderStatus
  items: SalesOrderItem[]
}

export interface SalesOrderUpdatePayload {
  prescription_id?: string
  notes?: string
  status?: SalesOrderStatus
  items?: SalesOrderItem[]
}

export interface SalesOrder {
  order_id: string
  order_number: string
  patient_id: string
  prescription_id?: string
  items: SalesOrderItem[]
  subtotal: number
  total_amount: number
  notes?: string
  invoice_id?: string
  status: SalesOrderStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface Transaction {
  transaction_id: string
  transaction_type: LedgerTransactionType
  reference_type: LedgerReferenceType
  reference_id: string
  amount: number
  payment_method?: PaymentMethod
  currency: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Payment {
  payment_id: string
  amount: number
  payment_method: PaymentMethod
  reference_type: LedgerReferenceType
  reference_id: string
  payment_date: string
  created_by: string
  transaction_id?: string
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  movement_id: string
  product_id: string
  movement_type: InventoryMovementType
  quantity: number
  reference_type: LedgerReferenceType
  reference_id: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  log_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_value?: unknown
  new_value?: unknown
  timestamp: string
  created_at: string
  updated_at: string
}