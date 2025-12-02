import { axiosInstance } from './axios'
import { Product, ProductFormData } from '@/types/product.types'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'

export const productsApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    search?: string
    category?: string
    low_stock?: boolean
  }): Promise<PaginatedResponse<Product>> => {
    const response = await axiosInstance.get<PaginatedResponse<Product>>('/products', { params })
    return response.data
  },

  getById: async (id: string): Promise<Product> => {
    const response = await axiosInstance.get<ApiResponse<Product>>(`/products/${id}`)
    return response.data.data
  },

  create: async (data: ProductFormData): Promise<Product> => {
    const response = await axiosInstance.post<ApiResponse<Product>>('/products', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<ProductFormData>): Promise<Product> => {
    const response = await axiosInstance.put<ApiResponse<Product>>(`/products/${id}`, data)
    return response.data.data
  },

  adjustStock: async (id: string, data: { quantity: number; reason: string; notes?: string }): Promise<void> => {
    await axiosInstance.post(`/products/${id}/adjust-stock`, data)
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/products/${id}`)
  },

  lookupBySKU: async (sku: string): Promise<Product> => {
    const response = await axiosInstance.get<ApiResponse<Product>>(`/products/scan/${sku}`)
    return response.data.data
  },

  getLabel: async (id: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/products/${id}/label`, {
      responseType: 'blob'
    })
    return response.data
  },
}
