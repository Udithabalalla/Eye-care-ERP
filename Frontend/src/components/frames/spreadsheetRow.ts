import type { FrameVariant } from '@/types/frames.types'

export interface SpreadsheetRow {
  id: string
  variant: FrameVariant | null
  qty: number
  cost_price: number
}

export function makeEmptyRow(): SpreadsheetRow {
  return {
    id: crypto.randomUUID(),
    variant: null,
    qty: 1,
    cost_price: 0,
  }
}
