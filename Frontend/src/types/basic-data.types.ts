export interface OtherExpenseType {
  id: string
  name: string
  default_cost: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OtherExpenseTypeFormData {
  name: string
  default_cost: number
  is_active: boolean
}

export interface LensMaster {
  id: string
  lens_type: string
  color: string
  size: string
  price: number
  lens_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LensMasterFormData {
  lens_type: string
  color: string
  size: string
  price: number
  lens_code: string
  is_active: boolean
}

export interface MasterDataQueryParams {
  page?: number
  page_size?: number
  search?: string
  is_active?: boolean
}

// ── Product Categories ─────────────────────────────────────────────────────

export interface ProductCategory {
  id: string
  name: string
  description?: string
  color?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductCategoryFormData {
  name: string
  description?: string
  color?: string
  is_active: boolean
}

// ── Complimentary Price Rules ──────────────────────────────────────────────

export interface CasePriceRule {
  id: string
  name: string
  min_price: number
  max_price?: number | null
  product_id: string    // product's custom product_id (e.g. "PRD000001")
  product_name: string  // denormalized
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CasePriceRuleFormData {
  name: string
  min_price: number
  max_price?: number | null
  product_id: string
  product_name: string
  priority: number
  is_active: boolean
}

export interface ComplimentaryProductSuggestion {
  rule_id: string
  rule_name: string
  product_id: string      // custom product_id
  product_name: string
  sku: string
  category: string
}

// ── Legacy — kept for existing complimentary_items collection ──────────────

export type ComplimentaryItemType = 'case' | 'bag'

export interface ComplimentaryItem {
  id: string
  name: string
  item_type: ComplimentaryItemType
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ComplimentaryItemFormData {
  name: string
  item_type: ComplimentaryItemType
  description?: string
  is_active: boolean
}
