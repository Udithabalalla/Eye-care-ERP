import { ProductCategory } from './common.types'

export interface Supplier {
  name?: string
  contact?: string
  email?: string
}

export interface Product {
  product_id: string
  name: string
  description?: string
  category: ProductCategory
  subcategory?: string
  brand?: string
  sku: string
  barcode?: string
  cost_price: number
  selling_price: number
  mrp: number
  discount_percentage: number
  tax_percentage: number
  current_stock: number
  min_stock_level: number
  max_stock_level: number
  reorder_quantity: number
  unit_of_measure: string
  supplier?: Supplier
  specifications?: Record<string, any>
  expiry_date?: string
  is_active: boolean
  is_prescription_required: boolean
  created_at: string
  updated_at: string
}

export interface ProductFormData {
  name: string
  description?: string
  category: ProductCategory
  brand?: string
  sku: string
  barcode?: string
  cost_price: number
  selling_price: number
  mrp: number
  current_stock: number
  min_stock_level: number
  supplier?: Supplier
}
