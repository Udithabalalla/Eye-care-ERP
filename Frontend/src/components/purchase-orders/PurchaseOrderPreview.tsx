import BrandLogo from '@/components/common/BrandLogo'
import { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate } from '@/utils/formatters'

export interface PurchaseOrderPreviewLine {
  key: string
  name: string
  /** e.g. "Frame · Black · 52 mm · BOS-1602-BLK-52-F" */
  detail?: string
  qty: number
  unitCost: number
  discount?: number
  total: number
}

export interface PurchaseOrderPreviewData {
  orderNumber?: string
  isDraft: boolean
  orderDate?: string
  expectedDelivery?: string
  paymentTerms?: string
  supplier: { name: string; company?: string; contact?: string; phone?: string; email?: string; address?: string }
  deliverTo: { location?: string; department?: string; address?: string; instructions?: string }
  lines: PurchaseOrderPreviewLine[]
  subtotal: number
  lineDiscounts: number
  discount: number
  tax: number
  shipping: number
  total: number
  supplierNote?: string
  approvedBy?: string
  approvedOn?: string
}

const money = (value: number) => formatCurrency(Math.round(value * 100) / 100)
const date = (value?: string) => (value ? formatDate(value, 'dd MMM yyyy') : '—')

/**
 * Paper-style preview of the supplier copy. It mirrors the PDF in backend
 * purchase_order_service._build_po_pdf and always renders on white, like the
 * printout. Internal notes never appear on it.
 */
const PurchaseOrderPreview = ({ data, company }: { data: PurchaseOrderPreviewData; company?: CompanyProfile }) => {
  const companyName = company?.company_name || 'Vision Opticals'
  const deliverHeading = [data.deliverTo.location, data.deliverTo.department].filter(Boolean).join(' · ')
  const hasDeliverTo = deliverHeading || data.deliverTo.address || data.deliverTo.instructions

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-4 pb-5 pt-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight">PURCHASE ORDER</p>
          <p className="mt-1 text-xs text-slate-500">
            PO number{' '}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
              {data.orderNumber ? `#${data.orderNumber}` : 'Assigned on save'}
            </span>
          </p>
          {data.isDraft && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              <span className="font-bold">DRAFT</span> — not yet approved
            </p>
          )}
        </div>
        <BrandLogo variant="full" className="h-16 w-20 shrink-0 text-[#007595]" title={companyName} />
      </div>

      <div className="space-y-5 border-t border-slate-100 px-4 py-5 sm:px-6">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="min-w-0 space-y-0.5">
            <p className="text-slate-500">Ordered by</p>
            <p className="font-semibold">{companyName}</p>
            {company?.address && <p className="text-slate-500">{company.address}</p>}
            {company?.phone && <p className="text-slate-500">{company.phone}</p>}
            {company?.email && <p className="truncate text-slate-500">{company.email}</p>}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-slate-500">Supplier</p>
            <p className={data.supplier.name ? 'font-semibold' : 'font-semibold italic text-slate-400'}>
              {data.supplier.name || 'Choose a supplier'}
            </p>
            {data.supplier.company && data.supplier.company !== data.supplier.name && <p className="text-slate-500">{data.supplier.company}</p>}
            {data.supplier.contact && <p className="text-slate-500">Attn: {data.supplier.contact}</p>}
            {data.supplier.phone && <p className="text-slate-500">{data.supplier.phone}</p>}
            {data.supplier.email && <p className="truncate text-slate-500">{data.supplier.email}</p>}
            {data.supplier.address && <p className="text-slate-500">{data.supplier.address}</p>}
          </div>
        </div>

        {/* Dates and terms */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-slate-500">Order date</p>
            <p className="font-semibold">{date(data.orderDate)}</p>
          </div>
          <div>
            <p className="text-slate-500">Expected delivery</p>
            <p className="font-semibold">{date(data.expectedDelivery)}</p>
          </div>
          <div>
            <p className="text-slate-500">Payment terms</p>
            <p className="font-semibold">{data.paymentTerms || 'As agreed'}</p>
          </div>
        </div>

        {hasDeliverTo && (
          <div className="space-y-0.5 text-xs">
            <p className="text-slate-500">Deliver to</p>
            {deliverHeading && <p className="font-semibold">{deliverHeading}</p>}
            {data.deliverTo.address && <p className="text-slate-600">{data.deliverTo.address}</p>}
            {data.deliverTo.instructions && <p className="text-slate-600">Instructions: {data.deliverTo.instructions}</p>}
          </div>
        )}

        {/* Items */}
        <div>
          <p className="mb-2 text-xs text-slate-500">Items ordered</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="rounded-l-md px-2.5 py-2 text-left font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Unit cost</th>
                <th className="rounded-r-md px-2.5 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-6 text-center italic text-slate-400">Items appear here as you add them</td>
                </tr>
              ) : (
                data.lines.map((line) => (
                  <tr key={line.key} className="align-top">
                    <td className="px-2.5 py-2">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {line.detail}
                        {line.discount ? ` · ${money(line.discount)} off` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{line.qty}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{money(line.unitCost)}</td>
                    <td className="px-2.5 py-2 text-right font-medium tabular-nums">{money(line.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals, with the approval beside them (same place as the PDF) */}
        <div className="flex items-start justify-between gap-3">
          {data.approvedBy && !data.isDraft ? (
            <div className="min-w-0 text-xs">
              <p className="text-slate-500">Approved by</p>
              <p className="font-semibold">{data.approvedBy}</p>
              <p className="text-slate-500">{date(data.approvedOn)}</p>
            </div>
          ) : <span />}
          <div className="w-full max-w-[16rem] space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums">{money(data.subtotal)}</span>
            </div>
            {data.lineDiscounts > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Line discounts</span>
                <span className="tabular-nums">−{money(data.lineDiscounts)}</span>
              </div>
            )}
            {data.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="tabular-nums">−{money(data.discount)}</span>
              </div>
            )}
            {data.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax</span>
                <span className="tabular-nums">{money(data.tax)}</span>
              </div>
            )}
            {data.shipping > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="tabular-nums">{money(data.shipping)}</span>
              </div>
            )}
            <div className="flex justify-between rounded-md bg-[#007595]/10 px-2 py-1.5 text-sm font-semibold text-[#007595]">
              <span>Order total</span>
              <span className="tabular-nums">{money(data.total)}</span>
            </div>
          </div>
        </div>

        {data.supplierNote && (
          <p className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Note:</span> {data.supplierNote}
          </p>
        )}

        <p className="border-t border-slate-100 pt-4 text-[11px] text-slate-500">
          All items are subject to quality inspection upon receipt. For questions about this order, please contact us using the details above.
        </p>
      </div>
    </div>
  )
}

export default PurchaseOrderPreview
