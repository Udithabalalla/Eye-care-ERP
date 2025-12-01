import { axiosInstance } from './axios'
import { Patient, PatientFormData } from '@/types/patient.types'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'

export const patientsApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    search?: string
  }): Promise<PaginatedResponse<Patient>> => {
    const response = await axiosInstance.get<PaginatedResponse<Patient>>('/patients', { params })
    return response.data
  },

  getById: async (id: string): Promise<Patient> => {
    const response = await axiosInstance.get<ApiResponse<Patient>>(`/patients/${id}`)
    return response.data.data
  },

  create: async (data: PatientFormData): Promise<Patient> => {
    const response = await axiosInstance.post<ApiResponse<Patient>>('/patients', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<PatientFormData>): Promise<Patient> => {
    const response = await axiosInstance.put<ApiResponse<Patient>>(`/patients/${id}`, data)
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/patients/${id}`)
  },
}
