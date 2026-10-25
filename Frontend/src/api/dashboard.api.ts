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

export interface DashboardOverview {
  date: string
  sales: { today: number; yesterday: number; invoices_today: number; month: number; last_month_same_period: number }
  collected: { today: number; month: number }
  daily: Array<{ date: string; sales: number; collected: number; invoices: number }>
  receivables: { total: number; count: number; overdue_total: number; overdue_count: number }
  payables: { total: number; count: number; overdue_total: number; overdue_count: number; due_this_week: number }
  pipeline: Array<{ stage: 'new' | 'lens_ordered' | 'fitting' | 'ready'; count: number }>
  ready_for_collection: Array<{
    order_id: string
    order_number: string
    patient_id: string
    patient_name?: string | null
    phone?: string | null
    balance_due: number
    waiting_days?: number | null
  }>
  ready_count: number
  appointments_today: Array<{
    appointment_id: string
    patient_id: string
    patient_name?: string
    doctor_name?: string
    time?: string | null
    type?: string
    status?: string
  }>
  sales_mix: Array<{ kind: 'frame' | 'lens' | 'product' | 'expense'; label: string; amount: number; count: number }>
  top_items: Array<{ name: string; kind: string; quantity: number; amount: number }>
  stock: {
    low: number
    out: number
    items: Array<{ kind: string; id: string; name: string; detail?: string | null; current_stock: number; reorder_level: number; out_of_stock: boolean }>
  }
  purchasing: { awaiting_delivery: number; awaiting_invoice: number }
  patients: { total: number; new_this_month: number }
}

export const dashboardApi = {
  /** Everything the dashboard shows, from real records */
  getOverview: async (): Promise<DashboardOverview> => {
    const response = await axiosInstance.get<ApiResponse<DashboardOverview>>('/dashboard/overview')
    return response.data.data
  },

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
