export interface ExpenseLineInput {
  qty: number
  unitCost: number
  discount: number
  expenseTypeGroup?: 'repair' | 'soldering' | 'other'
}

export interface OrderTotalsInput {
  frameTotal: number
  lensTotal: number
  expenses: ExpenseLineInput[]
  discount: number
  advancedPayment: number
  isOldOrder: boolean
}

export const roundCurrency = (value: number): number => {
  const numericValue = Number.isFinite(value) ? value : 0
  return Number(numericValue.toFixed(2))
}

export const calculateLineTotal = ({ qty, unitCost, discount }: ExpenseLineInput): number => {
  const quantity = Number.isFinite(qty) ? qty : 0
  const cost = Number.isFinite(unitCost) ? unitCost : 0
  const lineDiscount = Number.isFinite(discount) ? discount : 0
  return roundCurrency(Math.max(quantity * cost - lineDiscount, 0))
}

export const calculateExpensesTotal = (expenses: ExpenseLineInput[]): number => {
  return roundCurrency(expenses.reduce((sum, expense) => sum + calculateLineTotal(expense), 0))
}

export const calculateOrderTotals = ({
  frameTotal,
  lensTotal,
  expenses,
  discount,
  advancedPayment,
  isOldOrder,
}: OrderTotalsInput) => {
  const expenseTotal = calculateExpensesTotal(expenses)
  const repairTotal = roundCurrency(
    expenses
      .filter((expense) => expense.expenseTypeGroup !== 'soldering')
      .reduce((sum, expense) => sum + calculateLineTotal(expense), 0)
  )
  const solderingTotal = roundCurrency(
    expenses
      .filter((expense) => expense.expenseTypeGroup === 'soldering')
      .reduce((sum, expense) => sum + calculateLineTotal(expense), 0)
  )
  const subtotalBeforeDiscount = roundCurrency(
    Math.max(frameTotal, 0) + Math.max(lensTotal, 0) + expenseTotal
  )
  const discountTotal = roundCurrency(Math.max(discount, 0))
  const subtotal = roundCurrency(Math.max(subtotalBeforeDiscount - discountTotal, 0))
  const payment = roundCurrency(Math.max(advancedPayment, 0))
  const balancePayment = isOldOrder ? 0 : roundCurrency(Math.max(subtotal - payment, 0))

  return {
    frameTotal: roundCurrency(Math.max(frameTotal, 0)),
    lensTotal: roundCurrency(Math.max(lensTotal, 0)),
    expenseTotal,
    repairTotal,
    solderingTotal,
    discountTotal,
    subtotal,
    advancedPayment: isOldOrder ? subtotal : payment,
    balancePayment,
    fullPaymentDate: isOldOrder || balancePayment === 0 ? new Date().toISOString().split('T')[0] : '',
  }
}
