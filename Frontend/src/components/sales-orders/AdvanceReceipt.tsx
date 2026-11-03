import { renderToStaticMarkup } from 'react-dom/server'
import type { CompanyProfile } from '@/types/company-profile.types'
import type { Invoice } from '@/types/invoice.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'
import { code128Widths } from '@/utils/code128'

export type ReceiptPaperWidth = 58 | 80

export interface AdvanceReceiptLine {
  key: string
  name: string
  detail?: string
  qty: number
  unitPrice: number
  total: number
}

export interface AdvanceReceiptData {
  /** Printed as a barcode; scanning it on the Sales Orders page opens the order */
  orderId?: string
  orderNumber?: string
  invoiceNumber?: string
  orderDate: string
  customerName: string
  customerPhone?: string
  lines: AdvanceReceiptLine[]
  subtotal: number
  discount: number
  total: number
  paid: number
  balance: number
  dueDate?: string
  readyDate?: string
  issuedBy?: string
  printedAt: Date
}

// Same labels as the invoice, so the slip and the final receipt read alike
const LINE_LABELS: Record<string, string> = { frame: 'Frame', lens: 'Lens', expense: 'Service', product: 'Product' }

/**
 * The slip is for any invoice with a balance still to pay, whether or not an
 * advance was taken. Once settled, the invoice itself is the receipt.
 */
export const hasBalanceDue = (invoice?: Pick<Invoice, 'balance_due'>) => !!invoice && invoice.balance_due > 0

/** "advance receipt" once something is paid, "order receipt" while nothing is */
export const receiptSlipLabel = (invoice?: Pick<Invoice, 'paid_amount'>) =>
  invoice && invoice.paid_amount > 0 ? 'advance receipt' : 'order receipt'

export const isFullyPaid = (invoice?: Pick<Invoice, 'total_amount' | 'balance_due'>) =>
  !!invoice && invoice.total_amount > 0 && invoice.balance_due <= 0

export const invoiceToAdvanceReceipt = (
  invoice: Invoice,
  extra: { orderNumber?: string; readyDate?: string; issuedBy?: string } = {},
): AdvanceReceiptData => ({
  orderId: invoice.sales_order_id || undefined,
  orderNumber: extra.orderNumber,
  invoiceNumber: invoice.invoice_number,
  orderDate: invoice.invoice_date,
  customerName: invoice.patient_name,
  customerPhone: invoice.patient_phone,
  // Free items aren't listed for the customer (same as the invoice)
  lines: invoice.items.filter((item) => item.line_type !== 'complimentary').map((item, index) => ({
    key: `${item.product_id}-${index}`,
    name: item.product_name,
    detail: [LINE_LABELS[(item.line_type as string) || 'product'], item.sku].filter(Boolean).join(' · '),
    qty: item.quantity,
    unitPrice: item.unit_price,
    total: item.total,
  })),
  subtotal: invoice.subtotal,
  discount: invoice.total_discount || 0,
  total: invoice.total_amount,
  paid: invoice.paid_amount,
  balance: invoice.balance_due,
  dueDate: invoice.due_date,
  readyDate: extra.readyDate,
  issuedBy: extra.issuedBy,
  printedAt: new Date(),
})

// Line amounts go without the currency code so the column stays narrow; totals carry it
const amount = (value: number) =>
  roundCurrency(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (value: number) => formatCurrency(roundCurrency(value))
const day = (value?: string) => (value ? formatDate(value, 'dd MMM yyyy') : undefined)

// Blank modules either side of the bars, so a scanner can find where the code starts
const QUIET_ZONE = 10

/** Code 128 bars as SVG: one unit per module, stretched to the slip's width */
const Barcode = ({ value }: { value: string }) => {
  const widths = code128Widths(value)
  if (!widths) return null
  const total = widths.reduce((sum, w) => sum + w, 0) + QUIET_ZONE * 2
  let x = QUIET_ZONE
  const bars = widths.flatMap((w, i) => {
    const bar = i % 2 === 0 ? [<rect key={i} x={x} y={0} width={w} height={1} />] : []
    x += w
    return bar
  })
  return (
    <div className="barcode">
      <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={`Barcode ${value}`}>
        {bars}
      </svg>
      <p className="barcode-text">{value}</p>
    </div>
  )
}

const Row = ({ label, value, className }: { label: string; value?: string; className?: string }) =>
  value ? (
    <div className={`row ${className ?? ''}`}>
      <span>{label}</span>
      <span className="v">{value}</span>
    </div>
  ) : null

// The shop's brand, not the company profile name: without a saved profile that falls back to the app's name
const SHOP_NAME = 'Vision Opticals'
// Solid black on transparent, so it prints cleanly on thermal paper
const SHOP_LOGO = '/brand/logo-mark.png'

/**
 * The slip itself. Thermal paper prints black only, so everything is solid
 * black on white: no greys, no colour logo, rules instead of shaded boxes.
 */
const AdvanceReceiptSlip = ({ data, company }: { data: AdvanceReceiptData; company?: CompanyProfile }) => (
  <main>
    <header className="center">
      <img className="logo" src={SHOP_LOGO} alt="" />
      <p className="shop">{SHOP_NAME}</p>
      {company?.address && <p className="small">{company.address}</p>}
      {company?.phone && <p className="small">Tel: {company.phone}</p>}
    </header>

    <p className="title">{data.paid > 0 ? 'ADVANCE RECEIPT' : 'ORDER RECEIPT'}</p>
    <p className="subtitle">Not the final receipt</p>

    {data.orderNumber && <p className="order-no">{data.orderNumber}</p>}
    {data.orderId && <Barcode value={data.orderId} />}

    <div className="rule" />
    <Row label="Date" value={day(data.orderDate)} />
    <Row label="Invoice" value={data.invoiceNumber} />
    <Row label="Customer" value={data.customerName} />
    <Row label="Phone" value={data.customerPhone} />
    <div className="rule" />

    {data.lines.map((line) => (
      <div key={line.key} className="item">
        <p className="item-name">{line.name}</p>
        <div className="row small">
          <span>
            {line.qty} × {amount(line.unitPrice)}
            {line.detail ? ` · ${line.detail}` : ''}
          </span>
          <span className="num strong">{amount(line.total)}</span>
        </div>
      </div>
    ))}

    <div className="rule" />
    <Row label="Subtotal" value={amount(data.subtotal)} className="money" />
    {data.discount > 0 && <Row label="Discount" value={`-${amount(data.discount)}`} className="money" />}
    <Row label="TOTAL" value={money(data.total)} className="money total" />

    {/* The balance is what the customer comes back with, so it gets the most weight */}
    <div className="pay">
      <Row label={data.paid > 0 ? 'ADVANCE PAID' : 'PAID SO FAR'} value={money(data.paid)} className="money strong" />
      <div className="rule-solid" />
      <p className="balance-label">BALANCE DUE</p>
      <p className="balance">{money(data.balance)}</p>
      {data.dueDate && <p className="small center">Please pay by {day(data.dueDate)}</p>}
    </div>

    {data.readyDate && <Row label="Ready for collection" value={day(data.readyDate)} className="strong" />}

    <p className="note">
      Please keep this slip and bring it when you collect your order. Your full receipt is issued once the balance is paid.
    </p>
    <p className="thanks">Thank you!</p>

    <div className="rule" />
    <p className="small center">
      Printed {formatDate(data.printedAt, 'dd MMM yyyy, hh:mm a')}
      {data.issuedBy ? ` · ${data.issuedBy}` : ''}
    </p>
  </main>
)

const styles = (width: ReceiptPaperWidth) => {
  const narrow = width === 58
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { margin: 0; }
html, body { background: #fff; color: #000; }
body {
  width: ${width}mm;
  padding: 3mm ${narrow ? 2.5 : 4}mm 6mm;
  font-family: Arial, Helvetica, sans-serif;
  font-size: ${narrow ? 10.5 : 11.5}px;
  line-height: 1.35;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.center { text-align: center; }
.small { font-size: ${narrow ? 9.5 : 10.5}px; }
.strong { font-weight: 700; }
.logo { display: block; margin: 0 auto 3px; width: ${narrow ? 16 : 20}mm; height: auto; }
.shop { font-size: ${narrow ? 15 : 17}px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
.title { margin-top: 8px; padding: 4px 0; background: #000; color: #fff; text-align: center; font-size: ${narrow ? 12.5 : 14}px; font-weight: 800; letter-spacing: .18em; }
.subtitle { margin-top: 2px; text-align: center; font-size: ${narrow ? 9 : 10}px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.order-no { margin-top: 6px; text-align: center; font-size: ${narrow ? 16 : 19}px; font-weight: 800; letter-spacing: .04em; }
.barcode { margin: 6px auto 0; width: ${narrow ? 44 : 58}mm; }
.barcode svg { display: block; width: 100%; height: ${narrow ? 10 : 12}mm; fill: #000; }
.barcode-text { margin-top: 1px; text-align: center; font-size: ${narrow ? 9.5 : 10.5}px; font-weight: 700; letter-spacing: .12em; }
.rule { margin: 6px 0; border-top: 1px dashed #000; }
.rule-solid { margin: 4px 0; border-top: 1.5px solid #000; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.row .v { text-align: right; font-weight: 700; overflow-wrap: anywhere; }
.num, .row .v { font-variant-numeric: tabular-nums; }
.num, .money .v { white-space: nowrap; }
.item { margin: 4px 0; }
.item-name { font-weight: 700; word-break: break-word; }
.total { margin-top: 2px; font-size: ${narrow ? 13 : 14}px; font-weight: 800; }
.pay { margin: 8px 0; padding: 5px 6px; border: 2px solid #000; }
.balance-label { text-align: center; font-size: ${narrow ? 11 : 12}px; font-weight: 800; letter-spacing: .12em; }
.balance { text-align: center; font-size: ${narrow ? 18 : 21}px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.note { margin-top: 8px; text-align: center; font-size: ${narrow ? 9.5 : 10.5}px; }
.thanks { margin-top: 6px; text-align: center; font-size: 13px; font-weight: 800; }
`
}

/** A complete HTML page for the slip, ready for an iframe to show and print */
export const buildAdvanceReceiptDocument = (
  data: AdvanceReceiptData,
  company: CompanyProfile | undefined,
  width: ReceiptPaperWidth,
) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
${renderToStaticMarkup(<title>{`${data.paid > 0 ? 'Advance' : 'Order'} receipt ${data.orderNumber ?? data.invoiceNumber ?? ''}`}</title>)}
<style>${styles(width)}</style>
<style id="page-size"></style>
</head>
<body>${renderToStaticMarkup(<AdvanceReceiptSlip data={data} company={company} />)}</body>
</html>`
