import { axiosInstance } from './axios'
import { Appointment, AppointmentFormData, AppointmentUpdateData } from '@/types/appointment.types'
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

  /** Every appointment between two days (inclusive), page by page since the API caps pages at 100 */
  getAllInRange: async (start_date: string, end_date: string): Promise<Appointment[]> => {
    const all: Appointment[] = []
    for (let page = 1; ; page++) {
      const response = await axiosInstance.get<PaginatedResponse<Appointment>>('/appointments', {
        params: { start_date, end_date, page, page_size: 100 },
      })
      all.push(...response.data.data)
      if (page >= response.data.total_pages || response.data.data.length === 0) return all
    }
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

  update: async (id: string, data: AppointmentUpdateData): Promise<Appointment> => {
    const response = await axiosInstance.put<ApiResponse<Appointment>>(`/appointments/${id}`, data)
    return response.data.data
  },

  cancel: async (id: string, reason?: string): Promise<void> => {
    await axiosInstance.post(`/appointments/${id}/cancel`, { reason: reason || 'Cancelled by user' })
  },
}
