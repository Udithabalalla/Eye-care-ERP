import BrandLogo from '@/components/common/BrandLogo'
import { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'

export type InvoiceLineType = 'Frame' | 'Lens' | 'Accessory' | 'Service' | 'Free'

export interface InvoicePreviewLine {
  key: string
  name: string
  detail?: string
  type: InvoiceLineType
  qty: number
  unitPrice: number
  discount: number
  total: number
}

export interface InvoicePreviewData {
  invoiceNumber?: string
  salesOrderNumber?: string
  issueDate: string
  dueDate?: string
  billTo: { name: string; phone?: string; email?: string; address?: string }
  lines: InvoicePreviewLine[]
  subtotal: number
  discount: number
  total: number
  paid: number
  balance: number
  notes?: string
  /** Shown in the order summary only — the printed invoice doesn't carry it */
  testedBy?: string
  prescriptionRef?: string
  isHistorical?: boolean
}

const money = (value: number) => formatCurrency(roundCurrency(value))
const date = (value?: string) => (value ? formatDate(value, 'MMMM d, yyyy') : '—')

const isFullyPaid = (data: InvoicePreviewData) => !data.isHistorical && data.total > 0 && data.balance <= 0

/**
 * Payment status shown under the preview. The printout itself carries no
 * status — only the PAID seal once the invoice is settled.
 */
export const InvoicePreviewStatus = ({ data }: { data: InvoicePreviewData }) => {
  const status = data.isHistorical
    ? { label: 'Past order', detail: 'No invoice is created', dot: 'bg-slate-400' }
    : isFullyPaid(data)
      ? { label: 'Fully paid', detail: 'Prints with a PAID seal', dot: 'bg-emerald-500' }
      : data.paid > 0
        ? { label: 'Partially paid', detail: `${money(data.balance)} still to collect`, dot: 'bg-amber-500' }
        : { label: 'Not paid yet', detail: `${money(data.balance)} to collect`, dot: 'bg-slate-400' }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span className={`h-2 w-2 rounded-full ${status.dot}`} />
        {status.label}
      </span>
      <span className="text-muted-foreground">{status.detail}</span>
    </div>
  )
}

/**
 * Paper-style preview of the printed invoice. It mirrors the PDF layout in
 * backend invoice_service._build_invoice_pdf and always renders on white,
 * like the printout, whatever the app theme.
 */
const InvoicePreview = ({ data, company }: { data: InvoicePreviewData; company?: CompanyProfile }) => {
  const companyName = company?.company_name || 'Vision Opticals'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      {data.isHistorical && (
        <div className="bg-amber-50 px-4 py-2 sm:px-6 text-xs font-medium text-amber-800">
          Past order from paper records — no invoice will be created
        </div>
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4 px-4 pb-5 pt-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight">INVOICE</p>
          <p className="mt-1 text-xs text-slate-500">
            Invoice number{' '}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
              {data.invoiceNumber ? `#${data.invoiceNumber}` : 'Assigned on save'}
            </span>
          </p>
        </div>
        {/* Same seal the PDF stamps on a fully paid invoice */}
        {isFullyPaid(data) && (
          <div className="pointer-events-none absolute right-28 top-6 -rotate-12 rounded-lg border-2 border-emerald-600/80 p-0.5 text-emerald-600/85" aria-label="Paid">
            <div className="rounded-md border border-emerald-600/80 px-3 py-0.5 text-center">
              <p className="text-lg font-extrabold leading-tight tracking-[0.2em]">PAID</p>
              <p className="text-[8px] font-bold uppercase tracking-wider">{formatDate(new Date(), 'dd MMM yyyy')}</p>
            </div>
          </div>
        )}
        <BrandLogo variant="full" className="h-16 w-20 text-[#007595]" title={companyName} />
      </div>

      <div className="space-y-5 border-t border-slate-100 px-4 py-5 sm:px-6">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="min-w-0 space-y-0.5">
            <p className="text-slate-500">Billed by</p>
            <p className="font-semibold">{companyName}</p>
            {company?.email && <p className="truncate text-slate-500">{company.email}</p>}
            {company?.address && <p className="text-slate-500">{company.address}</p>}
            {company?.phone && <p className="text-slate-500">{company.phone}</p>}
            {company?.tax_number && <p className="text-slate-500">Tax no. {company.tax_number}</p>}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-slate-500">Billed to</p>
            <p className={`font-semibold ${data.billTo.name ? '' : 'italic text-slate-400'}`}>{data.billTo.name || 'Patient name'}</p>
            {data.billTo.phone && <p className="text-slate-500">{data.billTo.phone}</p>}
            {data.billTo.email && <p className="truncate text-slate-500">{data.billTo.email}</p>}
            {data.billTo.address && <p className="text-slate-500">{data.billTo.address}</p>}
          </div>
        </div>

        {/* Dates and references */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Date issued</p>
            <p className="font-semibold">{date(data.issueDate)}</p>
          </div>
          <div>
            <p className="text-slate-500">Due date</p>
            <p className="font-semibold">{date(data.dueDate)}</p>
          </div>
          <div>
            <p className="text-slate-500">Sales order</p>
            <p className="font-semibold">{data.salesOrderNumber || 'Assigned on save'}</p>
          </div>
          <div>
            <p className="text-slate-500">Prescription</p>
            <p className="font-semibold">{data.prescriptionRef || 'Assigned on save'}</p>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="mb-2 text-xs text-slate-500">Items & services</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="rounded-l-md px-2.5 py-2 text-left font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Price</th>
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
                        {line.type}{line.detail ? ` · ${line.detail}` : ''}
                        {line.discount > 0 ? ` · ${money(line.discount)} off` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{line.qty}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{line.type === 'Free' ? '—' : money(line.unitPrice)}</td>
                    <td className="px-2.5 py-2 text-right font-medium tabular-nums">
                      {line.type === 'Free' ? <span className="text-emerald-600">Free</span> : money(line.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="ml-auto w-full max-w-[16rem] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="tabular-nums">{money(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="tabular-nums">−{money(data.discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold">
            <span>Grand total</span>
            <span className="tabular-nums">{money(data.total)}</span>
          </div>
          {!data.isHistorical && data.paid > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Paid</span>
              <span className="tabular-nums">{money(data.paid)}</span>
            </div>
          )}
          {!data.isHistorical && (
            <div className="flex justify-between rounded-md bg-[#007595]/10 px-2 py-1.5 font-semibold text-[#007595]">
              <span>Balance due</span>
              <span className="tabular-nums">{money(data.balance)}</span>
            </div>
          )}
        </div>

        {data.notes && (
          <p className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Note:</span> {data.notes}
          </p>
        )}

        <p className="border-t border-slate-100 pt-4 text-[11px] text-slate-500">
          Thank you for your trust. For any questions regarding this invoice, please contact us using the details above.
        </p>
      </div>
    </div>
  )
}

export default InvoicePreview
