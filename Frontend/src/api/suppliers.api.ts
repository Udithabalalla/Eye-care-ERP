import { axiosInstance } from './axios'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'
import {
  PurchaseOrder,
  PurchaseOrderFormData,
  ReceiveStockFormData,
  Supplier,
  SupplierFormData,
  SupplierInvoice,
  SupplierInvoiceFormData,
  SupplierPayment,
  SupplierPaymentFormData,
} from '@/types/supplier.types'

export const suppliersApi = {
  getAll: async (params: {
    page?: number
    page_size?: number
    search?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<Supplier>> => {
    const response = await axiosInstance.get<PaginatedResponse<Supplier>>('/suppliers', { params })
    return response.data
  },

  getById: async (id: string): Promise<Supplier> => {
    const response = await axiosInstance.get<ApiResponse<Supplier>>(`/suppliers/${id}`)
    return response.data.data
  },

  create: async (data: SupplierFormData): Promise<Supplier> => {
    const response = await axiosInstance.post<ApiResponse<Supplier>>('/suppliers', data)
    return response.data.data
  },

  update: async (id: string, data: Partial<SupplierFormData>): Promise<Supplier> => {
    const response = await axiosInstance.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data)
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/suppliers/${id}`)
  },

  getPurchaseOrders: async (params: { page?: number; page_size?: number; supplier_id?: string; status?: string }): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await axiosInstance.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params })
    return response.data
  },

  createPurchaseOrder: async (data: PurchaseOrderFormData): Promise<PurchaseOrder> => {
    const response = await axiosInstance.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data)
    return response.data.data
  },

  getPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await axiosInstance.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`)
    return response.data.data
  },

  updatePurchaseOrderStatus: async (id: string, status: string): Promise<PurchaseOrder> => {
    const response = await axiosInstance.patch<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/status`, null, {
      params: { status },
    })
    return response.data.data
  },

  receiveStock: async (id: string, data: ReceiveStockFormData): Promise<PurchaseOrder> => {
    const response = await axiosInstance.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/receive`, data)
    return response.data.data
  },

  downloadPurchaseOrderPdf: async (id: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/purchase-orders/${id}/pdf`, {
      responseType: 'blob',
    })
    return response.data
  },

  getSupplierInvoices: async (params: { page?: number; page_size?: number; supplier_id?: string; status?: string }): Promise<PaginatedResponse<SupplierInvoice>> => {
    const response = await axiosInstance.get<PaginatedResponse<SupplierInvoice>>('/supplier-invoices', { params })
    return response.data
  },

  createSupplierInvoice: async (data: SupplierInvoiceFormData): Promise<SupplierInvoice> => {
    const response = await axiosInstance.post<ApiResponse<SupplierInvoice>>('/supplier-invoices', data)
    return response.data.data
  },

  recordSupplierInvoicePayment: async (invoiceId: string, data: Omit<SupplierPaymentFormData, 'invoice_id'>): Promise<SupplierPayment> => {
    const response = await axiosInstance.post<ApiResponse<SupplierPayment>>(`/supplier-invoices/${invoiceId}/payment`, data)
    return response.data.data
  },

  updateSupplierInvoice: async (id: string, data: Partial<SupplierInvoiceFormData>): Promise<SupplierInvoice> => {
    const response = await axiosInstance.patch<ApiResponse<SupplierInvoice>>(`/supplier-invoices/${id}`, data)
    return response.data.data
  },

  getSupplierPayments: async (params: { page?: number; page_size?: number; invoice_id?: string }): Promise<PaginatedResponse<SupplierPayment>> => {
    const response = await axiosInstance.get<PaginatedResponse<SupplierPayment>>('/supplier-payments', { params })
    return response.data
  },

  createSupplierPayment: async (data: SupplierPaymentFormData): Promise<SupplierPayment> => {
    const response = await axiosInstance.post<ApiResponse<SupplierPayment>>('/supplier-payments', data)
    return response.data.data
  },
}
