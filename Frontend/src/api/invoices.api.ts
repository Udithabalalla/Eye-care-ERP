import { axiosInstance } from './axios'
import { Invoice, InvoiceFormData } from '@/types/invoice.types'
import { ApiResponse, PaginatedResponse, PaymentMethod } from '@/types/common.types'

export const invoicesApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    patient_id?: string
    payment_status?: string
    start_date?: string
    end_date?: string
    search?: string
  }): Promise<PaginatedResponse<Invoice>> => {
    const response = await axiosInstance.get<PaginatedResponse<Invoice>>('/invoices', { params })
    return response.data
  },

  getByPatientId: async (patientId: string, params?: {
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<Invoice>> => {
    const response = await axiosInstance.get<PaginatedResponse<Invoice>>('/invoices', {
      params: {
        patient_id: patientId,
        ...params,
      },
    })
    return response.data
  },

  getById: async (id: string): Promise<Invoice> => {
    const response = await axiosInstance.get<ApiResponse<Invoice>>(`/invoices/${id}`)
    return response.data.data
  },

  create: async (data: InvoiceFormData): Promise<Invoice> => {
    const response = await axiosInstance.post<ApiResponse<Invoice>>('/invoices', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<InvoiceFormData>): Promise<Invoice> => {
    const response = await axiosInstance.put<ApiResponse<Invoice>>(`/invoices/${id}`, data)
    return response.data.data
  },

  recordPayment: async (id: string, data: {
    amount: number
    payment_method: PaymentMethod
    payment_date: string
    transaction_id?: string
  }): Promise<void> => {
    await axiosInstance.post('/payments', {
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      reference_type: 'INVOICE',
      reference_id: id,
    })
  },

  downloadPDF: async (id: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    })
    return response.data
  },
}
