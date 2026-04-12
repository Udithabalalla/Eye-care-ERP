import { axiosInstance } from './axios'
import { Prescription, PrescriptionFormData } from '@/types/prescription.types'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'

export const prescriptionsApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    patient_id?: string
    doctor_id?: string
  }): Promise<PaginatedResponse<Prescription>> => {
    const response = await axiosInstance.get<PaginatedResponse<Prescription>>('/prescriptions', { params })
    return response.data
  },

  getByPatientId: async (patientId: string, params?: {
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<Prescription>> => {
    const response = await axiosInstance.get<PaginatedResponse<Prescription>>('/prescriptions', {
      params: {
        patient_id: patientId,
        ...params,
      },
    })
    return response.data
  },

  getById: async (id: string): Promise<Prescription> => {
    const response = await axiosInstance.get<ApiResponse<Prescription>>(`/prescriptions/${id}`)
    return response.data.data
  },

  create: async (data: PrescriptionFormData): Promise<Prescription> => {
    const response = await axiosInstance.post<ApiResponse<Prescription>>('/prescriptions', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<PrescriptionFormData>): Promise<Prescription> => {
    const response = await axiosInstance.put<ApiResponse<Prescription>>(`/prescriptions/${id}`, data)
    return response.data.data
  },

  downloadPDF: async (id: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/prescriptions/${id}/pdf`, {
      responseType: 'blob',
    })
    return response.data
  },
}
