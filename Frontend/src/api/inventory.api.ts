import { axiosInstance } from './axios'

export type InventoryItemKind = 'frame' | 'product'

export interface LowStockItem {
  kind: InventoryItemKind
  id: string
  name: string
  detail?: string
  sku?: string
  current_stock: number
  reorder_level: number
  suggested_qty: number
  supplier_id?: string | null
  supplier_name?: string | null
  unit_cost?: number | null
  out_of_stock: boolean
  /** Frames only: the model this variant belongs to */
  frame_master_id?: string | null
}

export interface ReorderResult {
  purchase_orders: Array<{ order_id?: string; id?: string; order_number?: string; po_number?: string; supplier_id?: string; supplier_name?: string; line_count?: number }>
  skipped: Array<{ kind: InventoryItemKind; id: string; reason: string }>
}

/** Cross-cutting inventory endpoints (low stock, reorder, labels) for frames and products alike */
export const inventoryApi = {
  getLowStock: async (params?: { kind?: InventoryItemKind; out_of_stock_only?: boolean }): Promise<{ data: LowStockItem[]; total: number }> => {
    const res = await axiosInstance.get('/inventory/low-stock', { params })
    return { data: res.data.data ?? [], total: res.data.total ?? (res.data.data?.length ?? 0) }
  },

  reorder: async (items: Array<{ kind: InventoryItemKind; id: string; quantity: number }>): Promise<ReorderResult> => {
    const res = await axiosInstance.post('/inventory/reorder', { items })
    return res.data.data
  },

  printLabels: async (items: Array<{ kind: InventoryItemKind; id: string; copies: number }>, labelType = 'frame_tag'): Promise<Blob> => {
    const res = await axiosInstance.post('/inventory/labels', { items, label_type: labelType }, { responseType: 'blob' })
    return res.data
  },
}
