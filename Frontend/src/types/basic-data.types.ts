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
