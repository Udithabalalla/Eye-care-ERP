import { axiosInstance } from './axios'
import {
  FrameMaster, FrameMasterFormData,
  FrameVariant, FrameVariantFormData, BulkVariantCreate,
  GoodsReceipt, GoodsReceiptFormData,
  QuickIntake, QuickIntakeFormData,
} from '@/types/frames.types'
import { ApiResponse, PaginatedResponse } from '@/types/common.types'

// ─── Frame Masters ───────────────────────────────────────────────────────────

export const frameMastersApi = {
  getAll: async (params?: {
    page?: number; page_size?: number; search?: string
    brand?: string; category?: string; gender?: string
  }): Promise<PaginatedResponse<FrameMaster>> => {
    const safeParams = {
      ...params,
      page_size: params?.page_size ? Math.min(params.page_size, 100) : params?.page_size,
    }
    const res = await axiosInstance.get<PaginatedResponse<FrameMaster>>('/frame-masters', { params: safeParams })
    return res.data
  },

  getById: async (id: string): Promise<FrameMaster> => {
    const res = await axiosInstance.get<ApiResponse<FrameMaster>>(`/frame-masters/${id}`)
    return res.data.data
  },

  getBrands: async (): Promise<string[]> => {
    const res = await axiosInstance.get<ApiResponse<string[]>>('/frame-masters/brands')
    return res.data.data
  },

  create: async (data: FrameMasterFormData): Promise<FrameMaster> => {
    const res = await axiosInstance.post<ApiResponse<FrameMaster>>('/frame-masters', data)
    return res.data.data
  },

  update: async (id: string, data: Partial<FrameMasterFormData>): Promise<FrameMaster> => {
    const res = await axiosInstance.put<ApiResponse<FrameMaster>>(`/frame-masters/${id}`, data)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/frame-masters/${id}`)
  },
}

// ─── Frame Variants ──────────────────────────────────────────────────────────

export const frameVariantsApi = {
  getAll: async (params?: {
    page?: number; page_size?: number; search?: string
    frame_master_id?: string; brand?: string; color?: string
    rim_type?: string; supplier_id?: string
    low_stock?: boolean; out_of_stock?: boolean
  }): Promise<PaginatedResponse<FrameVariant>> => {
    const res = await axiosInstance.get<PaginatedResponse<FrameVariant>>('/frame-variants', { params })
    return res.data
  },

  getById: async (id: string): Promise<FrameVariant> => {
    const res = await axiosInstance.get<ApiResponse<FrameVariant>>(`/frame-variants/${id}`)
    return res.data.data
  },

  getForMaster: async (masterId: string): Promise<FrameVariant[]> => {
    const res = await axiosInstance.get<ApiResponse<FrameVariant[]>>(`/frame-variants/master/${masterId}`)
    return res.data.data
  },

  scanLookup: async (code: string): Promise<FrameVariant> => {
    const res = await axiosInstance.get<ApiResponse<FrameVariant>>(`/frame-variants/scan/${encodeURIComponent(code)}`)
    return res.data.data
  },

  getColors: async (): Promise<string[]> => {
    const res = await axiosInstance.get<ApiResponse<string[]>>('/frame-variants/colors')
    return res.data.data
  },

  create: async (data: FrameVariantFormData): Promise<FrameVariant> => {
    const res = await axiosInstance.post<ApiResponse<FrameVariant>>('/frame-variants', data)
    return res.data.data
  },

  bulkCreate: async (data: BulkVariantCreate): Promise<FrameVariant[]> => {
    const res = await axiosInstance.post<ApiResponse<FrameVariant[]>>('/frame-variants/bulk', data)
    return res.data.data
  },

  update: async (id: string, data: Partial<FrameVariantFormData>): Promise<FrameVariant> => {
    const res = await axiosInstance.put<ApiResponse<FrameVariant>>(`/frame-variants/${id}`, data)
    return res.data.data
  },

  adjustStock: async (id: string, data: { new_stock: number; reason: string }): Promise<FrameVariant> => {
    const res = await axiosInstance.post<ApiResponse<FrameVariant>>(`/frame-variants/${id}/adjust-stock`, data)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/frame-variants/${id}`)
  },

  getBarcodeUrl: (id: string): string =>
    `${axiosInstance.defaults.baseURL}/frame-variants/${id}/barcode`,

  getLabelPdf: async (id: string, labelType = 'frame_tag'): Promise<Blob> => {
    const res = await axiosInstance.get(`/frame-variants/${id}/label`, {
      params: { label_type: labelType },
      responseType: 'blob',
    })
    return res.data
  },
}

// ─── Goods Receipts ──────────────────────────────────────────────────────────

export const goodsReceiptsApi = {
  getAll: async (params?: {
    page?: number; page_size?: number
    supplier_id?: string; purchase_order_id?: string; search?: string
  }): Promise<PaginatedResponse<GoodsReceipt>> => {
    const res = await axiosInstance.get<PaginatedResponse<GoodsReceipt>>('/goods-receipts', { params })
    return res.data
  },

  getByGrn: async (grnNumber: string): Promise<GoodsReceipt> => {
    const res = await axiosInstance.get<ApiResponse<GoodsReceipt>>(`/goods-receipts/${grnNumber}`)
    return res.data.data
  },

  create: async (data: GoodsReceiptFormData): Promise<GoodsReceipt> => {
    const res = await axiosInstance.post<ApiResponse<GoodsReceipt>>('/goods-receipts', data)
    return res.data.data
  },

  update: async (grnNumber: string, data: Partial<GoodsReceiptFormData>): Promise<GoodsReceipt> => {
    const res = await axiosInstance.put<ApiResponse<GoodsReceipt>>(`/goods-receipts/${grnNumber}`, data)
    return res.data.data
  },

  commit: async (grnNumber: string): Promise<GoodsReceipt> => {
    const res = await axiosInstance.post<ApiResponse<GoodsReceipt>>(`/goods-receipts/${grnNumber}/commit`)
    return res.data.data
  },
}

// ─── Quick Intakes ───────────────────────────────────────────────────────────

export const quickIntakesApi = {
  getAll: async (params?: {
    page?: number; page_size?: number; status?: string; supplier_id?: string
  }): Promise<PaginatedResponse<QuickIntake>> => {
    const res = await axiosInstance.get<PaginatedResponse<QuickIntake>>('/quick-intakes', { params })
    return res.data
  },

  getById: async (id: string): Promise<QuickIntake> => {
    const res = await axiosInstance.get<ApiResponse<QuickIntake>>(`/quick-intakes/${id}`)
    return res.data.data
  },

  create: async (data: QuickIntakeFormData): Promise<QuickIntake> => {
    const res = await axiosInstance.post<ApiResponse<QuickIntake>>('/quick-intakes', data)
    return res.data.data
  },

  update: async (id: string, data: QuickIntakeFormData): Promise<QuickIntake> => {
    const res = await axiosInstance.put<ApiResponse<QuickIntake>>(`/quick-intakes/${id}`, data)
    return res.data.data
  },

  commit: async (id: string): Promise<QuickIntake> => {
    const res = await axiosInstance.post<ApiResponse<QuickIntake>>(`/quick-intakes/${id}/commit`)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/quick-intakes/${id}`)
  },
}
