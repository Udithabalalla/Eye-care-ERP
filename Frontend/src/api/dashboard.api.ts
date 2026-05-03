import { axiosInstance } from './axios'
import { ApiResponse } from '@/types/common.types'

export interface DashboardStats {
  total_patients: number
  total_appointments: number
  today_appointments: number
  pending_payments: number
  low_stock_items: number
  revenue_today: number
  revenue_month: number
  generated_at: string
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await axiosInstance.get<ApiResponse<DashboardStats>>('/dashboard/stats')
    return response.data.data
  },

  getRevenue: async (params: { start_date?: string; end_date?: string }): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse>('/dashboard/revenue', { params })
    return response.data.data
  },

  getAppointmentsSummary: async (): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse>('/dashboard/appointments-summary')
    return response.data.data
  },

  getOrderTypesSummary: async (): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse>('/dashboard/order-types')
    return response.data.data
  },

  getInventoryAlerts: async (): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse>('/dashboard/inventory-alerts')
    return response.data.data
  },
}
