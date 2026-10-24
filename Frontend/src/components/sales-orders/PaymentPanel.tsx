import { useEffect, useState } from 'react'
import { RiMoneyDollarCircleLine } from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'

type DiscountType = 'AMOUNT' | 'PERCENT'

const money = (value: number) => formatCurrency(roundCurrency(value))

const DISCOUNT_PRESETS = [0, 5, 10, 15] as const
const PAID_PRESETS = [
  { label: 'Nothing', share: 0 },
  { label: 'Half', share: 0.5 },
  { label: 'Full', share: 1 },
] as const

/** Compact single-choice pill group */
const Segmented = ({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
  ariaLabel: string
}) => (
  <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5">
    {options.map((option) => (
      <button
        key={option.key}
        type="button"
        role="radio"
        aria-checked={value === option.key}
        onClick={() => onChange(option.key)}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          value === option.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/** One line of the receipt: label (and its control) on the left, the amount on the right */
const Line = ({
  label,
  amount,
  sign,
  children,
  strong,
}: {
  label: string
  amount: number
  sign?: '−'
  children?: React.ReactNode
  strong?: boolean
}) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className={strong ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}>{label}</span>
      {children}
    </div>
    <span className={`ml-auto tabular-nums ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      {sign && amount > 0 ? `${sign} ` : ''}{money(amount)}
    </span>
  </div>
)

/**
 * Review & Pay payment block, laid out like a receipt so the balance can be
 * read at a glance: subtotal → discount → total → paid today → balance.
 */
const PaymentPanel = ({
  subtotal,
  discountTotal,
  total,
  paid,
  balance,
  discountType,
  discountValue,
  onDiscountChange,
  onPaidChange,
  dueDate,
  isHistorical,
  invoiceNumber,
}: {
  subtotal: number
  discountTotal: number
  total: number
  paid: number
  balance: number
  discountType: DiscountType
  discountValue: number
  onDiscountChange: (type: DiscountType, value: number) => void
  onPaidChange: (amount: number) => void
  dueDate?: string
  isHistorical: boolean
  invoiceNumber?: string
}) => {
  const discountPreset = discountValue === 0 ? '0' : discountType === 'PERCENT' && DISCOUNT_PRESETS.includes(discountValue as never) ? String(discountValue) : 'other'
  const paidPreset = PAID_PRESETS.find((p) => roundCurrency(total * p.share) === roundCurrency(paid))?.label ?? 'other'
  const [discountOther, setDiscountOther] = useState(false)
  const [paidOther, setPaidOther] = useState(false)
  // A "Half"/"Full" choice keeps following the total when the discount changes
  const [paidShare, setPaidShare] = useState<number | null>(null)

  useEffect(() => {
    if (paidShare === null) return
    const target = roundCurrency(total * paidShare)
    if (target !== roundCurrency(paid)) onPaidChange(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, paidShare])

  // Values that match no preset (e.g. a restored draft) show their input box
  const discountKey = discountOther ? 'other' : discountPreset
  const paidKey = paidOther ? 'other' : paidShare !== null ? (PAID_PRESETS.find((p) => p.share === paidShare)?.label ?? 'other') : paidPreset

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <RiMoneyDollarCircleLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Payment</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Choose a discount and what the patient pays today</p>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-2">
        <div className="divide-y divide-border">
          <Line label="Subtotal" amount={subtotal} />

          <Line label="Discount" amount={discountTotal} sign="−">
            <Segmented
              ariaLabel="Discount"
              value={discountKey}
              options={[
                { key: '0', label: 'None' },
                { key: '5', label: '5%' },
                { key: '10', label: '10%' },
                { key: '15', label: '15%' },
                { key: 'other', label: 'Other' },
              ]}
              onChange={(key) => {
                if (key === 'other') { setDiscountOther(true); return }
                setDiscountOther(false)
                const pct = Number(key)
                onDiscountChange(pct === 0 ? 'AMOUNT' : 'PERCENT', pct)
              }}
            />
            {discountKey === 'other' && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number" min={0} step="0.01" aria-label="Discount value"
                  max={discountType === 'PERCENT' ? 100 : undefined}
                  className="h-8 w-24 text-right"
                  value={discountValue || ''}
                  placeholder="0"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onDiscountChange(discountType, Number(e.target.value))}
                />
                <Segmented
                  ariaLabel="Discount type"
                  value={discountType}
                  options={[{ key: 'PERCENT', label: '%' }, { key: 'AMOUNT', label: 'LKR' }]}
                  onChange={(key) => onDiscountChange(key as DiscountType, discountValue)}
                />
              </div>
            )}
          </Line>

          <Line label="Total due" amount={total} strong />

          {!isHistorical && (
            <Line label="Paid today" amount={paid} sign="−">
              <Segmented
                ariaLabel="Paid today"
                value={paidKey}
                options={[...PAID_PRESETS.map((p) => ({ key: p.label, label: p.label })), { key: 'other', label: 'Other' }]}
                onChange={(key) => {
                  if (key === 'other') { setPaidOther(true); setPaidShare(null); return }
                  setPaidOther(false)
                  const preset = PAID_PRESETS.find((p) => p.label === key)
                  if (preset) { setPaidShare(preset.share); onPaidChange(roundCurrency(total * preset.share)) }
                }}
              />
              {paidKey === 'other' && (
                <Input
                  type="number" min={0} step="0.01" aria-label="Amount paid today"
                  className="h-8 w-32 text-right"
                  value={paid || ''}
                  placeholder="0.00"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => { setPaidShare(null); onPaidChange(Number(e.target.value)) }}
                />
              )}
            </Line>
          )}
        </div>

        {/* The number that matters: what's left to collect */}
        {!isHistorical && (
          <div className="mt-3 flex items-end justify-between gap-4 rounded-xl bg-primary/5 px-5 py-4 ring-1 ring-primary/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Balance to collect</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {balance <= 0 ? 'Nothing left to pay' : dueDate ? `Due by ${formatDate(dueDate, 'MMMM d, yyyy')}` : ''}
              </p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-primary">{money(balance)}</p>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {isHistorical
            ? 'Past order — no invoice will be created.'
            : invoiceNumber
              ? `Invoice ${invoiceNumber} created.`
              : 'The invoice is created when you save the order.'}
        </p>
      </CardContent>
    </Card>
  )
}

export default PaymentPanel
