import { useEffect, useState } from 'react'
import { RiMoneyDollarCircleLine } from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { PaymentMethod } from '@/types/common.types'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { roundCurrency } from '@/utils/salesOrderCalculations'

type DiscountType = 'AMOUNT' | 'PERCENT'

const money = (value: number) => formatCurrency(roundCurrency(value))

const DISCOUNT_PRESETS = [5, 10, 15] as const
const PAID_PRESETS = [
  { label: 'Nothing', share: 0 },
  { label: 'Half', share: 0.5 },
  { label: 'Full', share: 1 },
] as const
const PAYMENT_METHODS = [
  { key: PaymentMethod.CASH, label: 'Cash' },
  { key: PaymentMethod.CARD, label: 'Card' },
  { key: PaymentMethod.BANK_TRANSFER, label: 'Bank transfer' },
] as const

/** Compact single-choice pill group */
const Segmented = ({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  options: ReadonlyArray<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
  ariaLabel: string
  disabled?: boolean
}) => (
  <ToggleGroup
    type="single"
    value={value}
    onValueChange={(next) => next && onChange(next)}
    disabled={disabled}
    aria-label={ariaLabel}
    spacing={0}
    className="flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
  >
    {options.map((option) => (
      <ToggleGroupItem
        key={option.key}
        value={option.key}
        className="h-auto rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground disabled:opacity-60 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm group-data-[spacing=0]/toggle-group:rounded-md group-data-[spacing=0]/toggle-group:px-2.5"
      >
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
)

/** Amount box that's always there: type straight in, or let a quick pick fill it */
const AmountInput = ({
  value,
  onChange,
  prefix,
  suffix,
  ariaLabel,
  disabled,
  invalid,
  max,
}: {
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: React.ReactNode
  ariaLabel: string
  disabled?: boolean
  invalid?: boolean
  max?: number
}) => (
  <div className="relative">
    {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
    <Input
      type="number" min={0} max={max} step="0.01" inputMode="decimal"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      className={`h-8 w-32 text-right font-semibold tabular-nums ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-8' : ''}`}
      value={value || ''}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(Math.max(Number(e.target.value) || 0, 0))}
    />
    {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
  </div>
)

/** One line of the receipt: label (and its controls) on the left, the amount on the right */
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
      <span className={`w-24 shrink-0 ${strong ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}`}>{label}</span>
      {children}
    </div>
    <span className={`ml-auto tabular-nums ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      {sign && amount > 0 ? `${sign} ` : ''}{money(amount)}
    </span>
  </div>
)

/**
 * Review & Pay payment block, laid out like a receipt so the balance can be
 * read at a glance: subtotal → discount → total → paid → balance. Discount and
 * payment are typed straight into their boxes; the pills only fill them in.
 */
const PaymentPanel = ({
  subtotal,
  discountTotal,
  total,
  alreadyPaid = 0,
  paid,
  balance,
  discountType,
  discountValue,
  onDiscountChange,
  onPaidChange,
  paymentMethod,
  onPaymentMethodChange,
  dueDate,
  isHistorical,
  invoiceNumber,
  disabled,
}: {
  subtotal: number
  discountTotal: number
  total: number
  /** Paid before this visit (editing an order); "paid today" comes on top */
  alreadyPaid?: number
  paid: number
  balance: number
  discountType: DiscountType
  discountValue: number
  onDiscountChange: (type: DiscountType, value: number) => void
  onPaidChange: (amount: number) => void
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  dueDate?: string
  isHistorical: boolean
  invoiceNumber?: string
  /** Once the order is saved the figures are final */
  disabled?: boolean
}) => {
  // What's left to pay before today's payment; Half and Full are shares of this
  const due = roundCurrency(Math.max(total - alreadyPaid, 0))
  // A "Half"/"Full" pick keeps following the total when the discount changes
  const [paidShare, setPaidShare] = useState<number | null>(null)

  useEffect(() => {
    if (paidShare === null) return
    const target = roundCurrency(due * paidShare)
    if (target !== roundCurrency(paid)) onPaidChange(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, paidShare])

  const discountPreset = discountType === 'PERCENT' && DISCOUNT_PRESETS.includes(discountValue as never) ? String(discountValue) : discountValue ? '' : 'none'
  const paidPreset = paidShare !== null
    ? (PAID_PRESETS.find((p) => p.share === paidShare)?.label ?? '')
    : (PAID_PRESETS.find((p) => roundCurrency(due * p.share) === roundCurrency(paid))?.label ?? '')
  const overpaid = paid > due + 0.001

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <RiMoneyDollarCircleLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Payment</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Type a discount and what the patient pays today, or tap a quick pick</p>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-2">
        <div className="divide-y divide-border">
          <Line label="Subtotal" amount={subtotal} />

          <Line label="Discount" amount={discountTotal} sign="−">
            <Segmented
              ariaLabel="Quick discount"
              disabled={disabled}
              value={discountPreset}
              options={[{ key: 'none', label: 'None' }, ...DISCOUNT_PRESETS.map((pct) => ({ key: String(pct), label: `${pct}%` }))]}
              onChange={(key) => (key === 'none' ? onDiscountChange('AMOUNT', 0) : onDiscountChange('PERCENT', Number(key)))}
            />
            <div className="flex items-center gap-1.5">
              <AmountInput
                ariaLabel="Discount"
                disabled={disabled}
                value={discountValue}
                max={discountType === 'PERCENT' ? 100 : undefined}
                onChange={(value) => onDiscountChange(discountType, discountType === 'PERCENT' ? Math.min(value, 100) : value)}
              />
              <Segmented
                ariaLabel="Discount in"
                disabled={disabled}
                value={discountType}
                options={[{ key: 'PERCENT', label: '%' }, { key: 'AMOUNT', label: 'LKR' }]}
                onChange={(key) => onDiscountChange(key as DiscountType, discountValue)}
              />
            </div>
          </Line>

          <Line label="Total due" amount={total} strong />

          {!isHistorical && alreadyPaid > 0 && <Line label="Already paid" amount={alreadyPaid} sign="−" />}

          {!isHistorical && (
            <Line label="Paid today" amount={paid} sign="−">
              <Segmented
                ariaLabel="Quick payment"
                disabled={disabled}
                value={paidPreset}
                options={PAID_PRESETS.map((p) => ({ key: p.label, label: p.label }))}
                onChange={(key) => {
                  const preset = PAID_PRESETS.find((p) => p.label === key)
                  if (!preset) return
                  setPaidShare(preset.share)
                  onPaidChange(roundCurrency(due * preset.share))
                }}
              />
              <AmountInput
                ariaLabel="Amount paid today"
                prefix="LKR"
                disabled={disabled}
                invalid={overpaid}
                value={paid}
                onChange={(value) => { setPaidShare(null); onPaidChange(value) }}
              />
              {paid > 0 && (
                <Segmented
                  ariaLabel="Paid by"
                  disabled={disabled}
                  value={paymentMethod}
                  options={PAYMENT_METHODS}
                  onChange={(key) => onPaymentMethodChange(key as PaymentMethod)}
                />
              )}
              {overpaid && <p className="w-full text-xs text-destructive">That's more than the {money(due)} left to pay.</p>}
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
