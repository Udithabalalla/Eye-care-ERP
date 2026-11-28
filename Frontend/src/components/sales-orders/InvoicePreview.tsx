import type { ReactNode } from 'react'
import BrandLogo from '@/components/common/BrandLogo'
import OrderQrCode from '@/components/common/OrderQrCode'
import { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate, withoutInternalIds } from '@/utils/formatters'
import { invoiceAppearanceOf, invoiceColourVars } from '@/utils/invoiceAppearance'
import { customerInvoiceLines } from '@/utils/invoicePreview'
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
  /** Several order lines shown as one (see customerInvoiceLines): no type or code under the name */
  grouped?: boolean
}

/** One payment on the invoice, e.g. the advance or the full payment (see utils/invoicePreview paymentLines) */
export interface InvoicePaymentLine {
  label: string
  date: string
  amount: number
  method?: string
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
  /** Each payment with its date; without them the invoice shows one "Paid" line */
  payments?: InvoicePaymentLine[]
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

// Colours from the Vision Opticals invoice design; the invoice looks the same whatever the app
// theme. The accent (teal by default) comes from Settings → Invoice Appearance as CSS variables.
const TEAL = 'text-[color:var(--inv-accent)]'
const NAVY = 'text-[#14324a]'
const SLOGAN = 'You Protect Eye, Eye Protects You'

/** The brand wordmark from the invoice design: "Vision" over "Opticals." */
const Wordmark = () => (
  <p className="text-[23px] font-bold leading-[1.05] tracking-tight">
    <span className={NAVY}>Vision</span>
    <br />
    <span className={TEAL}>Opticals.</span>
  </p>
)

const TotalRow = ({ label, value, strong, note, ruled }: { label: string; value: string; strong?: boolean; note?: string; ruled?: boolean }) => (
  <div className={`flex justify-between gap-3 px-2 ${strong ? 'py-1.5 text-[12.5px] font-bold text-slate-900' : 'py-1 text-[9.5px] text-slate-600'} ${ruled ? 'border-t border-slate-900' : ''}`}>
    <span>
      {label}
      {note && <span className="block text-[9px] text-slate-500">{note}</span>}
    </span>
    <span className="tabular-nums">{value}</span>
  </div>
)

const SmallLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-0.5 text-[9px] uppercase tracking-wide text-slate-500">{children}</p>
)

/**
 * The customer invoice, laid out for A5 paper (128 mm of printable width; body text
 * prints at about 8 pt, the smallest at about 6.8 pt) and the same
 * on screen, so the preview is what prints. `printable` is the copy sent to the printer
 * (utils/printInvoice scales it to the chosen paper): no card frame, no on-screen
 * placeholders, and the order's QR code in the footer.
 *
 * The shop's invoice appearance (company.invoice_appearance) sets the layout (classic,
 * split, ledger), accent colour, typeface, spacing and which parts show, the same way the
 * PDF does (backend invoice_service._build_invoice_pdf).
 */
const InvoicePreview = ({ data, company, printable = false }: { data: InvoicePreviewData; company?: CompanyProfile; printable?: boolean }) => {
  const look = invoiceAppearanceOf(company)
  const { layout } = look
  const roomy = look.spacing === 'roomy'
  // The glasses as one line, extra inventory items on their own, free items left off
  const lines = customerInvoiceLines(data.lines)
  const pending = printable ? '—' : 'Assigned on save'
  const tax = data.tax ?? 0
  // A hidden tax or discount line is folded into the subtotal, so the figures still add up
  const subtotal = data.subtotal + (look.show_tax ? 0 : tax) - (look.show_discount ? 0 : data.discount)
  const due = data.dueDate
    ? (data.issueDate && data.dueDate.slice(0, 10) <= data.issueDate.slice(0, 10) ? 'On receipt' : date(data.dueDate))
    : null

  const showTaxNumber = !!company?.tax_number && look.show_tax
  const hasOffice = !!(company?.address || company?.phone || showTaxNumber)
  const office = (
    <>
      {company?.address && <p>{company.address}</p>}
      {company?.phone && <p className="pt-1 text-slate-900">{company.phone}</p>}
      {showTaxNumber && <p className="text-slate-500">Tax no. {company?.tax_number}</p>}
    </>
  )
  const customer = (
    <>
      <p className={data.billTo.name ? 'text-slate-900' : 'italic text-slate-400'}>{data.billTo.name || 'Patient name'}</p>
      {data.billTo.phone && <p>{data.billTo.phone}</p>}
      {data.billTo.email && <p className="truncate">{data.billTo.email}</p>}
      {data.billTo.address && <p>{data.billTo.address}</p>}
    </>
  )
  const brand = (
    <div className="shrink-0">
      {look.show_logo && <BrandLogo variant="mark" className={`mb-1 h-10 w-[4.5rem] ${TEAL}`} title="Vision Opticals" />}
      <Wordmark />
    </div>
  )
  const invoiceNumber = data.invoiceNumber ? `#${data.invoiceNumber}` : pending

  return (
    <div
      // Printed, it fills the page (utils/printInvoice sets the height) so the footer sits at the foot
      className={`flex flex-col bg-white text-[11px] leading-snug text-slate-700 ${look.typeface === 'mono' ? 'font-mono' : ''} ${printable ? 'min-h-[inherit]' : 'overflow-hidden rounded-xl border border-slate-200 px-5 py-5 shadow-sm'}`}
      style={invoiceColourVars(look.accent)}
    >
      {data.isHistorical && (
        <p className="-mx-5 -mt-5 mb-4 bg-amber-50 px-5 py-2 text-[12px] font-medium text-amber-800">
          Past order from paper records — no invoice will be created
        </p>
      )}

      {layout === 'split' ? (
        // Brand and the shop on the left; a tinted panel with the invoice and the customer on the right
        <div className="grid grid-cols-[48fr_52fr] gap-4">
          <div className="min-w-0 space-y-0.5">
            {brand}
            {hasOffice && (
              <div className={roomy ? 'pt-5' : 'pt-3'}>
                <SmallLabel>From</SmallLabel>
                {office}
              </div>
            )}
          </div>
          <div className={`min-w-0 rounded-md bg-[color:var(--inv-panel)] px-4 ${roomy ? 'py-3.5' : 'py-2'}`}>
            <p className={`text-[24px] font-bold leading-none tracking-tight ${TEAL}`}>INVOICE</p>
            {/* Wraps in a narrow drawer rather than running out of the panel */}
            <p className={`mt-2 [overflow-wrap:anywhere] ${NAVY}`}>Invoice No - {invoiceNumber}</p>
            <p className={NAVY}>Issued {date(data.issueDate)}</p>
            {due && <p className={NAVY}>Due {due === 'On receipt' ? 'on receipt' : due}</p>}
            <div className={roomy ? 'pt-3.5' : 'pt-2'}>
              <SmallLabel>Bill to</SmallLabel>
              {customer}
            </div>
          </div>
        </div>
      ) : layout === 'ledger' ? (
        // A book-keeping look: the details as a list on the right, everything ruled
        <>
          <div className="flex items-start justify-between gap-4">
            {brand}
            <div className="min-w-0 text-right">
              <p className={`text-[20px] font-bold leading-none tracking-tight ${TEAL}`}>INVOICE</p>
              <dl className="mt-2.5 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5">
                <dt className="text-[10px] text-slate-500">Invoice No</dt>
                <dd className="text-slate-900 [overflow-wrap:anywhere]">{invoiceNumber}</dd>
                <dt className="text-[10px] text-slate-500">Issued</dt>
                <dd className="text-slate-900">{date(data.issueDate)}</dd>
                {due && (
                  <>
                    <dt className="text-[10px] text-slate-500">Due</dt>
                    <dd className="text-slate-900">{due}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
          <div className={`grid grid-cols-2 gap-4 border-t border-slate-900 ${roomy ? 'mt-5 pt-3' : 'mt-3 pt-2'}`}>
            <div className="min-w-0 space-y-0.5">
              {hasOffice && (
                <>
                  <SmallLabel>From</SmallLabel>
                  {office}
                </>
              )}
            </div>
            <div className="min-w-0 space-y-0.5 pl-4">
              <SmallLabel>Bill to</SmallLabel>
              {customer}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Brand and title */}
          <div className="flex items-start justify-between gap-4">
            {brand}
            <div className="min-w-0 text-right">
              <p className={`text-[34px] font-bold leading-none tracking-tight ${TEAL}`}>INVOICE</p>
              <p className={`mt-2 whitespace-nowrap text-[12px] ${NAVY}`}>
                Invoice No - {invoiceNumber}
              </p>
              <p className={`text-[12px] ${NAVY}`}>{date(data.issueDate)}</p>
            </div>
          </div>

          {/* From / to */}
          <div className={`${roomy ? 'mt-8' : 'mt-5'} grid grid-cols-2 gap-4`}>
            <div className="min-w-0 space-y-0.5">
              <p className="text-slate-900">Office Address</p>
              {office}
            </div>
            <div className="min-w-0 space-y-0.5 pl-4">
              <p className="text-slate-900">To :</p>
              {customer}
            </div>
          </div>
        </>
      )}

      {/* Items */}
      <table className={`${roomy ? 'mt-7' : 'mt-4'} w-full border-collapse`}>
        <thead>
          {layout === 'classic' ? (
            // Colour on the cells too: a row background alone leaves light seams between the cells in print
            <tr className="bg-[color:var(--inv-accent)] text-left text-[11px] text-white [&>th]:bg-[color:var(--inv-accent)]">
              <th className={`${roomy ? 'py-2' : 'py-1'} pl-2.5 font-normal`}>Items</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-4 text-right font-normal`}>Unit Price</th>
              <th className={`w-12 ${roomy ? 'py-2' : 'py-1'} text-center font-normal`}>Qnt</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-2.5 text-right font-normal`}>Total</th>
            </tr>
          ) : layout === 'split' ? (
            <tr className={`border-b-2 border-[color:var(--inv-accent)] text-left text-[11px] ${TEAL}`}>
              <th className={`${roomy ? 'py-2' : 'py-1'} pl-2.5 font-normal`}>Items</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-4 text-right font-normal`}>Unit Price</th>
              <th className={`w-12 ${roomy ? 'py-2' : 'py-1'} text-center font-normal`}>Qnt</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-2.5 text-right font-normal`}>Total</th>
            </tr>
          ) : (
            <tr className="border-y border-slate-900 text-left text-[9px] uppercase tracking-wide text-slate-500">
              <th className={`${roomy ? 'py-2' : 'py-1'} pl-2.5 font-normal`}>Items</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-4 text-right font-normal`}>Unit Price</th>
              <th className={`w-12 ${roomy ? 'py-2' : 'py-1'} text-center font-normal`}>Qty</th>
              <th className={`${roomy ? 'py-2' : 'py-1'} pr-2.5 text-right font-normal`}>Total</th>
            </tr>
          )}
        </thead>
        <tbody className={layout === 'ledger' ? 'border-b border-slate-900 [&>tr:nth-child(even)]:bg-[color:var(--inv-zebra)]' : ''}>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center italic text-slate-400">Items appear here as you add them</td>
            </tr>
          ) : (
            lines.map((line) => {
              const detail = [
                look.show_line_details && !line.grouped && line.type,
                look.show_line_details && !line.grouped && withoutInternalIds(line.detail),
                look.show_discount && line.discount > 0 && `${money(line.discount)} off`,
              ].filter(Boolean)
              const cell = roomy ? 'py-2' : 'py-1'
              return (
                <tr key={line.key} className={`align-top ${layout === 'ledger' ? '' : 'border-b border-[color:var(--inv-rule)]'}`}>
                  <td className={`${cell} pl-2.5 pr-2`}>
                    <p className="text-[12px] text-slate-900">{line.name}</p>
                    {detail.length > 0 && <p className="text-[9px] text-slate-500">{detail.join(' · ')}</p>}
                  </td>
                  <td className={`whitespace-nowrap ${cell} pr-4 text-right tabular-nums text-slate-900`}>{money(line.unitPrice)}</td>
                  <td className={`${cell} text-center tabular-nums`}>{line.qty}</td>
                  <td className={`whitespace-nowrap ${cell} pr-2.5 text-right tabular-nums text-slate-900`}>{money(line.total)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {/* Totals. No PAID seal: staff stamp settled invoices by hand */}
      <div className={`${roomy ? 'mt-3' : 'mt-2'} flex justify-end`}>
        <div className="w-[52%] shrink-0">
          <div className={`flex justify-between gap-3 border-b border-[color:var(--inv-rule)] px-2 py-1.5 text-[12px] font-bold ${layout === 'ledger' ? 'text-slate-900' : TEAL}`}>
            <span>SUBTOTAL :</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
          {tax > 0 && look.show_tax && <TotalRow label="Tax :" value={money(tax)} />}
          {data.discount > 0 && look.show_discount && <TotalRow label="Discount :" value={`−${money(data.discount)}`} />}
          <TotalRow strong ruled={layout === 'ledger'} label="Grand Total :" value={money(data.total)} />
          {/* Each payment with its date (advance, then the full payment); a settled invoice shows no balance */}
          {!data.isHistorical && data.payments?.length && look.show_payment_details
            ? data.payments.map((payment, index) => (
                <TotalRow key={`${payment.date}-${index}`} label={`${payment.label} :`} note={formatDate(payment.date, 'dd MMM yyyy')} value={money(payment.amount)} />
              ))
            : !data.isHistorical && data.paid > 0 && <TotalRow label="Paid :" value={money(data.paid)} />}
          {!data.isHistorical && data.balance > 0 && (
            <div
              className={`mt-1 flex justify-between gap-3 rounded-md px-2 ${roomy ? 'py-2' : 'py-1.5'} text-[12.5px] font-bold text-slate-900 ${
                layout === 'ledger' ? 'border border-[color:var(--inv-accent)]' : 'bg-[color:var(--inv-balance)]'
              }`}
            >
              <span>Balance Due :</span>
              <span className="tabular-nums">{money(data.balance)}</span>
            </div>
          )}
        </div>
      </div>

      {data.notes && look.show_notes && (
        <p className={`${roomy ? 'mt-3' : 'mt-2'} rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600`}>
          <span className="font-semibold text-slate-800">Note:</span> {data.notes}
        </p>
      )}

      {/* Slogan and thanks */}
      <div className={`mt-auto flex items-baseline justify-between gap-3 ${roomy ? 'pt-4' : 'pt-2.5'} text-[11px] font-bold ${TEAL}`}>
        <p className="italic">{SLOGAN}</p>
        <p>Thank You For Your Trust</p>
      </div>

      {/* Footer: contacts, the order's QR code, terms */}
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-4 border-t border-[color:var(--inv-accent)] pt-2.5">
        <div className="min-w-0">
          <p className={`mb-1 text-[12px] font-bold ${TEAL}`}>Contacts</p>
          {company?.email && (
            <p className="grid grid-cols-[3.9rem_1fr] text-[9px]">
              <span>Email us</span>
              <span className="truncate">: {company.email}</span>
            </p>
          )}
          {company?.phone && (
            <p className="grid grid-cols-[3.9rem_1fr] text-[9px]">
              <span>Call us</span>
              <span>: {company.phone}</span>
            </p>
          )}
        </div>
        <div className="flex justify-center">
          {printable && data.salesOrderId ? (
            <OrderQrCode value={data.salesOrderId} className={`font-bold ${TEAL}`} codeClassName="size-[4.5rem]" labelClassName="-mt-0.5 text-[9px]" />
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="min-w-0">
          {company?.invoice_terms && (
            <>
              <p className={`mb-1 text-[12px] font-bold ${TEAL}`}>Terms & Conditions</p>
              <p className="whitespace-pre-line text-[9px]">{company.invoice_terms}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoicePreview
