import { axiosInstance } from './axios'
import { Appointment, AppointmentFormData } from '@/types/appointment.types'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'

export const appointmentsApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    patient_id?: string
    doctor_id?: string
    start_date?: string
    end_date?: string
    status?: string
  }): Promise<PaginatedResponse<Appointment>> => {
    const response = await axiosInstance.get<PaginatedResponse<Appointment>>('/appointments', { params })
    return response.data
  },

  getByPatientId: async (patientId: string, params?: {
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<Appointment>> => {
    const response = await axiosInstance.get<PaginatedResponse<Appointment>>('/appointments', {
      params: {
        patient_id: patientId,
        ...params,
      },
    })
    return response.data
  },

  getById: async (id: string): Promise<Appointment> => {
    const response = await axiosInstance.get<ApiResponse<Appointment>>(`/appointments/${id}`)
    return response.data.data
  },

  create: async (data: AppointmentFormData): Promise<Appointment> => {
    const response = await axiosInstance.post<ApiResponse<Appointment>>('/appointments', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<AppointmentFormData>): Promise<Appointment> => {
    const response = await axiosInstance.put<ApiResponse<Appointment>>(`/appointments/${id}`, data)
    return response.data.data
  },

  cancel: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/appointments/${id}`)
  },
}
