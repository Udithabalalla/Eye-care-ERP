import { z } from 'zod'
import { localDateString } from '@/utils/formatters'

/* Rules and helpers shared by the stock drawers (receive, adjust, create PO) */

export const today = () => localDateString()

/** A whole number of at least `min`, kept as the text the user typed */
export const wholeNumber = (min: number, message: string) =>
  z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= min, message)

/** An optional amount of 0 or more; empty means "use the default" */
export const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter 0 or more')

export const toQty = (value: string) => parseInt(value, 10) || 0
export const costOr = (value: string, fallback: number) => (value !== '' ? parseFloat(value) : fallback)

export const receiveSchema = z.object({
  qty: wholeNumber(1, 'Receive at least 1'),
  cost: optionalAmount,
  intake_date: z.string().min(1, 'Choose the receipt date'),
  reference_no: z.string(),
  supplier_id: z.string(),
  notes: z.string(),
})
export type ReceiveValues = z.infer<typeof receiveSchema>

export const receiveDefaults = (): ReceiveValues => ({
  qty: '1',
  cost: '',
  intake_date: today(),
  reference_no: '',
  supplier_id: '',
  notes: '',
})

/** What to send for a receipt: the item fields differ between variants and products */
export const intakePayload = (values: ReceiveValues, defaultCost: number) => ({
  supplier_id: values.supplier_id || undefined,
  intake_date: new Date(values.intake_date).toISOString(),
  reference_no: values.reference_no || undefined,
  notes: values.notes || undefined,
  qty: toQty(values.qty),
  cost_price: costOr(values.cost, defaultCost),
})
