import { PurchaseOrder, PurchaseOrderItem } from '@/types/supplier.types'
import { PurchaseOrderPreviewData } from '@/components/purchase-orders/PurchaseOrderPreview'

const KIND_LABELS: Record<string, string> = { frame: 'Frame', product: 'Product' }

/** "Frame · Black · 52 mm · BOS-1602-BLK-52-F" — the second line under a PO item */
export const purchaseOrderLineDetail = (item: Pick<PurchaseOrderItem, 'item_type' | 'item_detail' | 'sku'>) =>
  [item.item_type ? KIND_LABELS[item.item_type] : undefined, item.item_detail, item.sku].filter(Boolean).join(' · ')

/** A saved purchase order in the shape the printable preview takes */
export function purchaseOrderToPreviewData(order: PurchaseOrder, approverName?: string): PurchaseOrderPreviewData {
  const summary = order.order_summary
  const supplier = order.supplier_information
  const shipping = order.shipping_information
  return {
    orderNumber: order.id,
    isDraft: order.status === 'Draft',
    orderDate: order.order_date,
    expectedDelivery: order.expected_delivery_date,
    paymentTerms: order.payment_terms?.payment_terms,
    supplier: {
      name: supplier?.supplier_name || order.supplier_id,
      company: supplier?.company_name,
      contact: supplier?.contact_person,
      phone: supplier?.phone,
      email: supplier?.email,
      address: supplier?.address,
    },
    deliverTo: {
      location: shipping?.ship_to_location,
      department: shipping?.receiving_department,
      address: shipping?.delivery_address,
      instructions: shipping?.delivery_instructions,
    },
    lines: order.items.map((item, index) => ({
      key: item.id || `${item.product_id}-${index}`,
      name: item.item_name || item.product_id,
      detail: purchaseOrderLineDetail(item),
      qty: item.quantity,
      unitCost: item.unit_cost,
      discount: item.line_discount_amount,
      total: item.total_price ?? item.quantity * item.unit_cost,
    })),
    subtotal: summary?.subtotal ?? order.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0),
    lineDiscounts: summary?.line_discount_total ?? 0,
    discount: summary?.discount ?? 0,
    tax: summary?.tax_amount ?? 0,
    shipping: summary?.shipping_cost ?? 0,
    total: order.total_amount,
    supplierNote: order.notes?.supplier_notes,
    approvedBy: order.authorization?.approved_by ? approverName || order.authorization.approved_by : undefined,
    approvedOn: order.authorization?.approval_date,
  }
}
