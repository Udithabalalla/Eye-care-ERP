import { axiosInstance } from './axios'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'
import {
  LensMaster,
  LensMasterFormData,
  MasterDataQueryParams,
  OtherExpenseType,
  OtherExpenseTypeFormData,
  ProductCategory,
  ProductCategoryFormData,
  ComplimentaryItem,
  ComplimentaryItemFormData,
  CasePriceRule,
  CasePriceRuleFormData,
  ComplimentaryProductSuggestion,
} from '@/types/basic-data.types'

const withStableId = <T extends { id?: string; _id?: string }>(item: T): T & { id: string } => ({
  ...item,
  id: item.id || item._id || '',
})

export const basicDataApi = {
  // ── Other Expenses ───────────────────────────────────────────────────────
  getOtherExpenses: async (params?: MasterDataQueryParams): Promise<PaginatedResponse<OtherExpenseType>> => {
    const response = await axiosInstance.get<PaginatedResponse<OtherExpenseType>>('/basic-data/other-expenses', { params })
    return { ...response.data, data: response.data.data.map((item) => withStableId(item)) }
  },
  getOtherExpenseById: async (id: string): Promise<OtherExpenseType> => {
    const response = await axiosInstance.get<ApiResponse<OtherExpenseType>>(`/basic-data/other-expenses/${id}`)
    return withStableId(response.data.data)
  },
  createOtherExpense: async (data: OtherExpenseTypeFormData): Promise<OtherExpenseType> => {
    const response = await axiosInstance.post<ApiResponse<OtherExpenseType>>('/basic-data/other-expenses', data)
    return withStableId(response.data.data)
  },
  updateOtherExpense: async (id: string, data: Partial<OtherExpenseTypeFormData>): Promise<OtherExpenseType> => {
    const response = await axiosInstance.put<ApiResponse<OtherExpenseType>>(`/basic-data/other-expenses/${id}`, data)
    return withStableId(response.data.data)
  },
  setOtherExpenseStatus: async (id: string, is_active: boolean): Promise<OtherExpenseType> => {
    const response = await axiosInstance.patch<ApiResponse<OtherExpenseType>>(`/basic-data/other-expenses/${id}/status`, { is_active })
    return withStableId(response.data.data)
  },

  // ── Lenses ───────────────────────────────────────────────────────────────
  getLenses: async (params?: MasterDataQueryParams): Promise<PaginatedResponse<LensMaster>> => {
    const response = await axiosInstance.get<PaginatedResponse<LensMaster>>('/basic-data/lenses', { params })
    return { ...response.data, data: response.data.data.map((item) => withStableId(item)) }
  },
  getLensById: async (id: string): Promise<LensMaster> => {
    const response = await axiosInstance.get<ApiResponse<LensMaster>>(`/basic-data/lenses/${id}`)
    return withStableId(response.data.data)
  },
  createLens: async (data: LensMasterFormData): Promise<LensMaster> => {
    const response = await axiosInstance.post<ApiResponse<LensMaster>>('/basic-data/lenses', data)
    return withStableId(response.data.data)
  },
  updateLens: async (id: string, data: Partial<LensMasterFormData>): Promise<LensMaster> => {
    const response = await axiosInstance.put<ApiResponse<LensMaster>>(`/basic-data/lenses/${id}`, data)
    return withStableId(response.data.data)
  },
  setLensStatus: async (id: string, is_active: boolean): Promise<LensMaster> => {
    const response = await axiosInstance.patch<ApiResponse<LensMaster>>(`/basic-data/lenses/${id}/status`, { is_active })
    return withStableId(response.data.data)
  },

  // ── Product Categories ───────────────────────────────────────────────────
  getProductCategories: async (params?: MasterDataQueryParams): Promise<PaginatedResponse<ProductCategory>> => {
    const response = await axiosInstance.get<PaginatedResponse<ProductCategory>>('/basic-data/product-categories', { params })
    return { ...response.data, data: response.data.data.map((item) => withStableId(item)) }
  },
  createProductCategory: async (data: ProductCategoryFormData): Promise<ProductCategory> => {
    const response = await axiosInstance.post<ApiResponse<ProductCategory>>('/basic-data/product-categories', data)
    return withStableId(response.data.data)
  },
  updateProductCategory: async (id: string, data: Partial<ProductCategoryFormData>): Promise<ProductCategory> => {
    const response = await axiosInstance.put<ApiResponse<ProductCategory>>(`/basic-data/product-categories/${id}`, data)
    return withStableId(response.data.data)
  },
  setProductCategoryStatus: async (id: string, is_active: boolean): Promise<ProductCategory> => {
    const response = await axiosInstance.patch<ApiResponse<ProductCategory>>(`/basic-data/product-categories/${id}/status`, { is_active })
    return withStableId(response.data.data)
  },

  // ── Complimentary Price Rules ────────────────────────────────────────────
  getCasePriceRules: async (params?: MasterDataQueryParams): Promise<PaginatedResponse<CasePriceRule>> => {
    const response = await axiosInstance.get<PaginatedResponse<CasePriceRule>>('/basic-data/case-price-rules', { params })
    return { ...response.data, data: response.data.data.map((item) => withStableId(item)) }
  },
  createCasePriceRule: async (data: CasePriceRuleFormData): Promise<CasePriceRule> => {
    const response = await axiosInstance.post<ApiResponse<CasePriceRule>>('/basic-data/case-price-rules', data)
    return withStableId(response.data.data)
  },
  updateCasePriceRule: async (id: string, data: Partial<CasePriceRuleFormData>): Promise<CasePriceRule> => {
    const response = await axiosInstance.put<ApiResponse<CasePriceRule>>(`/basic-data/case-price-rules/${id}`, data)
    return withStableId(response.data.data)
  },
  deleteCasePriceRule: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/basic-data/case-price-rules/${id}`)
  },
  setCasePriceRuleStatus: async (id: string, is_active: boolean): Promise<CasePriceRule> => {
    const response = await axiosInstance.patch<ApiResponse<CasePriceRule>>(`/basic-data/case-price-rules/${id}/status`, { is_active })
    return withStableId(response.data.data)
  },
  suggestComplimentary: async (frame_price: number): Promise<ComplimentaryProductSuggestion | null> => {
    const response = await axiosInstance.get<ApiResponse<ComplimentaryProductSuggestion | null>>('/basic-data/case-price-rules/suggest', { params: { frame_price } })
    return response.data.data ?? null
  },

  // ── Legacy complimentary items (backward compat) ─────────────────────────
  getComplimentaryItems: async (params?: MasterDataQueryParams & { item_type?: string }): Promise<PaginatedResponse<ComplimentaryItem>> => {
    const response = await axiosInstance.get<PaginatedResponse<ComplimentaryItem>>('/basic-data/complimentary-items', { params })
    return { ...response.data, data: response.data.data.map((item) => withStableId(item)) }
  },
  createComplimentaryItem: async (data: ComplimentaryItemFormData): Promise<ComplimentaryItem> => {
    const response = await axiosInstance.post<ApiResponse<ComplimentaryItem>>('/basic-data/complimentary-items', data)
    return withStableId(response.data.data)
  },
  updateComplimentaryItem: async (id: string, data: Partial<ComplimentaryItemFormData>): Promise<ComplimentaryItem> => {
    const response = await axiosInstance.put<ApiResponse<ComplimentaryItem>>(`/basic-data/complimentary-items/${id}`, data)
    return withStableId(response.data.data)
  },
  setComplimentaryItemStatus: async (id: string, is_active: boolean): Promise<ComplimentaryItem> => {
    const response = await axiosInstance.patch<ApiResponse<ComplimentaryItem>>(`/basic-data/complimentary-items/${id}/status`, { is_active })
    return withStableId(response.data.data)
  },
}
