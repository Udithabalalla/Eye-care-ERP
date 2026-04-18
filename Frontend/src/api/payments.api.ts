import { axiosInstance } from './axios'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'
import { LedgerReferenceType, Payment, PaymentCreatePayload } from '@/types/erp.types'

export const paymentsApi = {
  getAll: async (params?: { page?: number; page_size?: number; reference_type?: LedgerReferenceType | ''; reference_id?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<Payment>>('/payments', { params })
    return response.data
  },

  create: async (data: PaymentCreatePayload): Promise<Payment> => {
    const response = await axiosInstance.post<ApiResponse<Payment>>('/payments', data)
    return response.data.data
  },
}
