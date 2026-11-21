import BrandLogo from '@/components/common/BrandLogo'
import OrderQrCode from '@/components/common/OrderQrCode'
import { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'

// Matches the line labels printed on the PDF
export type InvoiceLineType = 'Frame' | 'Lens' | 'Product' | 'Service' | 'Free'

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
  /** The order's ID, printed as a QR code so scanning the invoice opens the order */
  salesOrderId?: string
  issueDate: string
  dueDate?: string
  billTo: { name: string; phone?: string; email?: string; address?: string }
  lines: InvoicePreviewLine[]
  subtotal: number
  discount: number
  /** Tax on the invoice, if any; shown as its own line */
  tax?: number
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
 * status; staff stamp settled invoices with a PAID seal by hand.
 */
export const InvoicePreviewStatus = ({ data }: { data: InvoicePreviewData }) => {
  const status = data.isHistorical
    ? { label: 'Past order', detail: 'No invoice is created', dot: 'bg-slate-400' }
    : isFullyPaid(data)
      ? { label: 'Fully paid', detail: 'Balance settled', dot: 'bg-emerald-500' }
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

// Colours from the Vision Opticals invoice design; the invoice looks the same whatever the app theme
const TEAL = 'text-[#1f6378]'
const NAVY = 'text-[#14324a]'
const SLOGAN = 'You Protect Eye, Eye Protects You'

/** The brand wordmark from the invoice design: "Vision" over "Opticals." */
const Wordmark = () => (
  <p className="text-[19px] font-bold leading-[1.05] tracking-tight">
    <span className={NAVY}>Vision</span>
    <br />
    <span className={TEAL}>Opticals.</span>
  </p>
)

const TotalRow = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between gap-3 px-2 ${strong ? 'py-1.5 text-[10.5px] font-bold text-slate-900' : 'py-1 text-[8px] text-slate-600'}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
)

/**
 * The customer invoice, laid out for A5 paper (128 mm of printable width) and the same
 * on screen, so the preview is what prints. `printable` is the copy sent to the printer
 * (utils/printInvoice scales it to the chosen paper): no card frame, no on-screen
 * placeholders, and the order's QR code in the footer.
 */
const InvoicePreview = ({ data, company, printable = false }: { data: InvoicePreviewData; company?: CompanyProfile; printable?: boolean }) => {
  // Free items stay on the order for stock, but the customer's invoice doesn't list them (same as the PDF)
  const lines = data.lines.filter((line) => line.type !== 'Free')
  const pending = printable ? '—' : 'Assigned on save'
  const tax = data.tax ?? 0
  const refs = [
    data.salesOrderNumber && `Order ${data.salesOrderNumber}`,
    data.dueDate && `Due ${date(data.dueDate)}`,
    data.prescriptionRef && `Rx ${data.prescriptionRef}`,
  ].filter(Boolean)

  return (
    <div
      // Printed, it fills the page (utils/printInvoice sets the height) so the footer sits at the foot
      className={`flex flex-col bg-white text-[9px] leading-snug text-slate-700 ${printable ? 'min-h-[inherit]' : 'overflow-hidden rounded-xl border border-slate-200 px-5 py-5 shadow-sm'}`}
    >
      {data.isHistorical && (
        <p className="-mx-5 -mt-5 mb-4 bg-amber-50 px-5 py-2 text-[10px] font-medium text-amber-800">
          Past order from paper records — no invoice will be created
        </p>
      )}

      {/* Brand and title */}
      <div className="flex items-start justify-between gap-4">
        <div className="shrink-0">
          <BrandLogo variant="mark" className={`mb-1 h-8 w-14 ${TEAL}`} title="Vision Opticals" />
          <Wordmark />
        </div>
        <div className="min-w-0 text-right">
          <p className={`text-[28px] font-bold leading-none tracking-tight ${TEAL}`}>INVOICE</p>
          <p className={`mt-2 whitespace-nowrap text-[10px] font-bold ${NAVY}`}>
            Invoice No - {data.invoiceNumber ? `#${data.invoiceNumber}` : pending}
          </p>
          <p className={`text-[10px] font-bold ${NAVY}`}>{date(data.issueDate)}</p>
          {refs.length > 0 && <p className="mt-0.5 text-[8px] text-slate-500">{refs.join(' · ')}</p>}
        </div>
      </div>

      {/* From / to */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="font-bold text-slate-900">Office Address</p>
          {company?.address && <p>{company.address}</p>}
          {company?.phone && <p className="pt-1 font-bold text-slate-900">{company.phone}</p>}
          {company?.tax_number && <p className="text-slate-500">Tax no. {company.tax_number}</p>}
        </div>
        <div className="min-w-0 space-y-0.5 pl-4">
          <p className="font-bold text-slate-900">To :</p>
          <p className={`font-bold ${data.billTo.name ? 'text-slate-900' : 'italic text-slate-400'}`}>{data.billTo.name || 'Patient name'}</p>
          {data.billTo.phone && <p>{data.billTo.phone}</p>}
          {data.billTo.email && <p className="truncate">{data.billTo.email}</p>}
          {data.billTo.address && <p>{data.billTo.address}</p>}
        </div>
      </div>

      {/* Items */}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-[#1f6378] text-left text-[9px] text-white">
            <th className="py-2 pl-2.5 font-medium">Items</th>
            <th className="py-2 text-right font-medium">Unit Price</th>
            <th className="w-10 py-2 text-center font-medium">Qnt</th>
            <th className="py-2 pr-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center italic text-slate-400">Items appear here as you add them</td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.key} className="border-b border-[#1f6378]/25 align-top">
                <td className="py-2 pl-2.5 pr-2">
                  <p className="text-[10px] font-bold text-slate-900">{line.name}</p>
                  <p className="text-[7.5px] text-slate-500">
                    {line.type}{line.detail ? ` · ${line.detail}` : ''}
                    {line.discount > 0 ? ` · ${money(line.discount)} off` : ''}
                  </p>
                </td>
                <td className="whitespace-nowrap py-2 text-right font-semibold tabular-nums text-slate-900">{money(line.unitPrice)}</td>
                <td className="py-2 text-center tabular-nums">{line.qty}</td>
                <td className="whitespace-nowrap py-2 pr-2.5 text-right font-semibold tabular-nums text-slate-900">{money(line.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals. No PAID seal: staff stamp settled invoices by hand */}
      <div className="mt-3 flex justify-end">
        <div className="w-[52%] shrink-0">
          <div className={`flex justify-between gap-3 border-b border-[#1f6378]/25 px-2 py-1.5 text-[10px] font-bold ${TEAL}`}>
            <span>SUBTOTAL :</span>
            <span className="tabular-nums">{money(data.subtotal)}</span>
          </div>
          {tax > 0 && <TotalRow label="Tax :" value={money(tax)} />}
          {data.discount > 0 && <TotalRow label="Discount :" value={`−${money(data.discount)}`} />}
          <TotalRow strong label="Grand Total :" value={money(data.total)} />
          {!data.isHistorical && data.paid > 0 && <TotalRow label="Paid :" value={money(data.paid)} />}
          {!data.isHistorical && (
            <div className="mt-1 flex justify-between gap-3 rounded-md bg-[#c8e2ea] px-2 py-2 text-[10.5px] font-bold text-slate-900">
              <span>Balance Due :</span>
              <span className="tabular-nums">{money(data.balance)}</span>
            </div>
          )}
        </div>
      </div>

      {data.notes && (
        <p className="mt-3 rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600">
          <span className="font-semibold text-slate-800">Note:</span> {data.notes}
        </p>
      )}

      {/* Slogan and thanks */}
      <div className={`mt-auto flex items-baseline justify-between gap-3 pt-4 text-[9.5px] font-bold ${TEAL}`}>
        <p className="italic">{SLOGAN}</p>
        <p>Thank You For Your Trust</p>
      </div>

      {/* Footer: contacts, the order's QR code, terms */}
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-4 border-t border-[#1f6378] pt-2.5">
        <div className="min-w-0">
          <p className={`mb-1 text-[10px] font-bold ${TEAL}`}>Contacts</p>
          {company?.email && (
            <p className="grid grid-cols-[3.2rem_1fr] text-[7.5px]">
              <span>Email us</span>
              <span className="truncate">: {company.email}</span>
            </p>
          )}
          {company?.phone && (
            <p className="grid grid-cols-[3.2rem_1fr] text-[7.5px]">
              <span>Call us</span>
              <span>: {company.phone}</span>
            </p>
          )}
        </div>
        <div className="flex justify-center">
          {printable && data.salesOrderId ? (
            <OrderQrCode value={data.salesOrderId} className={`font-bold ${TEAL}`} codeClassName="size-16" labelClassName="-mt-0.5 text-[7.5px]" />
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="min-w-0">
          {company?.invoice_terms && (
            <>
              <p className={`mb-1 text-[10px] font-bold ${TEAL}`}>Terms & Conditions</p>
              <p className="whitespace-pre-line text-[7.5px]">{company.invoice_terms}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoicePreview
