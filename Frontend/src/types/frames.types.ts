export interface FrameImage {
  url: string
  is_primary: boolean
  caption?: string
}

export interface FrameMaster {
  frame_master_id: string
  brand: string
  model_code: string
  frame_name: string
  material?: string
  shape?: string
  rim_type?: string
  gender?: string
  category: string
  description?: string
  default_eye_size?: number
  default_bridge_size?: number
  default_temple_length?: number
  supplier_ids: string[]
  images: FrameImage[]
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  variant_count: number
  total_stock: number
}

export interface FrameMasterFormData {
  brand: string
  model_code: string
  frame_name: string
  material?: string
  shape?: string
  rim_type?: string
  gender?: string
  category?: string
  description?: string
  default_eye_size?: number
  default_bridge_size?: number
  default_temple_length?: number
  supplier_ids?: string[]
  tags?: string[]
}

export interface FrameMasterRef {
  brand: string
  model_code: string
  frame_name: string
  category?: string
  shape?: string
}

export interface FrameVariant {
  variant_id: string
  sku: string
  barcode: string
  frame_master_id: string
  frame_master_ref: FrameMasterRef
  color: string
  color_code?: string
  eye_size: number
  bridge_size?: number
  temple_length?: number
  rim_type: string
  cost_price: number
  selling_price: number
  mrp: number
  current_stock: number
  reorder_level: number
  supplier_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FrameVariantFormData {
  frame_master_id: string
  color: string
  color_code?: string
  eye_size: number
  bridge_size?: number
  temple_length?: number
  rim_type?: string
  cost_price: number
  selling_price: number
  mrp?: number
  current_stock?: number
  reorder_level?: number
  supplier_id?: string
}

export interface BulkVariantCreate {
  frame_master_id: string
  colors: string[]
  eye_sizes: number[]
  rim_type?: string
  bridge_size?: number
  temple_length?: number
  cost_price: number
  selling_price: number
  mrp?: number
  reorder_level?: number
  supplier_id?: string
}

export interface GoodsReceiptItem {
  variant_id: string
  sku: string
  variant_label: string
  expected_qty: number
  received_qty: number
  damaged_qty: number
  missing_qty: number
  extra_qty: number
  cost_price: number
  notes?: string
}

export interface GoodsReceipt {
  id?: string
  grn_number: string
  purchase_order_id?: string
  supplier_id: string
  receipt_date: string
  items: GoodsReceiptItem[]
  status: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface GoodsReceiptFormData {
  purchase_order_id?: string
  supplier_id: string
  receipt_date?: string
  items: Omit<GoodsReceiptItem, 'variant_label'>[]
  notes?: string
}

export interface QuickIntakeItem {
  variant_id: string
  sku: string
  variant_label: string
  qty: number
  cost_price: number
}

export interface QuickIntake {
  id?: string
  intake_id: string
  supplier_id?: string
  intake_date: string
  items: QuickIntakeItem[]
  status: 'draft' | 'committed'
  notes?: string
  committed_at?: string
  created_by?: string
  created_at: string
  updated_at: string
  total_cost: number
  total_qty: number
}

export interface QuickIntakeFormData {
  supplier_id?: string
  items?: Omit<QuickIntakeItem, 'variant_label'>[]
  notes?: string
}

// ─── Enums / constants used in dropdowns ────────────────────────────────────

export const FRAME_MATERIALS = ['acetate', 'metal', 'titanium', 'tr90', 'mixed', 'wood', 'other']
export const FRAME_SHAPES = ['rectangle', 'square', 'round', 'oval', 'cat-eye', 'aviator', 'geometric', 'other']
export const RIM_TYPES = ['full', 'half', 'rimless']
export const FRAME_GENDERS = ['men', 'women', 'unisex', 'kids']
export const FRAME_CATEGORIES = ['optical', 'sunglasses', 'sports', 'safety', 'reading']
