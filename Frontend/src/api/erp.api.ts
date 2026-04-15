import { axiosInstance } from './axios'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'
import {
  SalesOrder,
  SalesOrderCreatePayload,
  SalesOrderUpdatePayload,
  InventoryMovement,
  Payment,
  Transaction,
  AuditLog,
  SalesOrderStatus,
  LedgerTransactionType,
  LedgerReferenceType,
} from '@/types/erp.types'
import { Invoice } from '@/types/invoice.types'

export const salesOrdersApi = {
  getAll: async (params?: { page?: number; page_size?: number; patient_id?: string; status?: SalesOrderStatus }) => {
    const response = await axiosInstance.get<PaginatedResponse<SalesOrder>>('/sales-orders', { params })
    return response.data
  },
  getById: async (id: string) => {
    const response = await axiosInstance.get<ApiResponse<SalesOrder>>(`/sales-orders/${id}`)
    return response.data.data
  },
  create: async (data: SalesOrderCreatePayload) => {
    const response = await axiosInstance.post<ApiResponse<SalesOrder>>('/sales-orders', data)
    return response.data.data
  },
  update: async (id: string, data: SalesOrderUpdatePayload) => {
    const response = await axiosInstance.put<ApiResponse<SalesOrder>>(`/sales-orders/${id}`, data)
    return response.data.data
  },
  updateStatus: async (id: string, status: SalesOrderStatus) => {
    const response = await axiosInstance.patch<ApiResponse<SalesOrder>>(`/sales-orders/${id}/status`, { status })
    return response.data.data
  },
  convertToInvoice: async (id: string) => {
    const response = await axiosInstance.post<ApiResponse<Invoice>>(`/sales-orders/${id}/convert-to-invoice`)
    return response.data.data
  },
}

export const transactionsApi = {
  getAll: async (params?: {
    page?: number
    page_size?: number
    transaction_type?: LedgerTransactionType | ''
    payment_method?: string | ''
    reference_type?: LedgerReferenceType | ''
    start_date?: string
    end_date?: string
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<Transaction>>('/transactions', { params })
    return response.data
  },
}

export const paymentsApi = {
  getAll: async (params?: { page?: number; page_size?: number; reference_type?: LedgerReferenceType | ''; reference_id?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<Payment>>('/payments', { params })
    return response.data
  },
}

export const inventoryMovementsApi = {
  getAll: async (params?: { page?: number; page_size?: number; product_id?: string; reference_type?: LedgerReferenceType | '' }) => {
    const response = await axiosInstance.get<PaginatedResponse<InventoryMovement>>('/inventory-movements', { params })
    return response.data
  },
}

export const auditLogsApi = {
  getAll: async (params?: { page?: number; page_size?: number; user_id?: string; entity_type?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<AuditLog>>('/audit-logs', { params })
    return response.data
  },
}