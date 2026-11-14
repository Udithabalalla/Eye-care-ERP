import type { CompanyProfile } from '@/types/company-profile.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'
import { code128Widths } from '@/utils/code128'
import type { AdvanceReceiptData } from './AdvanceReceipt'

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
export const AdvanceReceiptSlip = ({ data, company }: { data: AdvanceReceiptData; company?: CompanyProfile }) => (
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
