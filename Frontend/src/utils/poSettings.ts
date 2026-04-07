import type { BuyerInformation } from '@/types/supplier.types'

const STORAGE_KEY = 'po_buyer_information'

const defaultBuyerInformation: BuyerInformation = {
  company_logo: 'Logo.png',
}

export const getSavedBuyerInformation = (): BuyerInformation => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultBuyerInformation
    }

    const parsed = JSON.parse(raw) as BuyerInformation
    return {
      ...defaultBuyerInformation,
      ...parsed,
      company_logo: parsed.company_logo || 'Logo.png',
    }
  } catch {
    return defaultBuyerInformation
  }
}

export const saveBuyerInformation = (buyerInformation: BuyerInformation) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...buyerInformation,
      company_logo: buyerInformation.company_logo || 'Logo.png',
    }),
  )
}

export const clearBuyerInformation = () => {
  localStorage.removeItem(STORAGE_KEY)
}
