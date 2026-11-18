// How this device prints invoices. The printer belongs to the device (the shop tablet
// picks it in Android's print screen), so these live in the browser, not on the server.

export type PaperSize = 'B5' | 'JIS-B5' | 'A4' | 'A5'

export const PAPER_SIZES: Record<PaperSize, { label: string; detail: string; widthMm: number; heightMm: number }> = {
  B5: { label: 'B5', detail: '176 × 250 mm', widthMm: 176, heightMm: 250 },
  'JIS-B5': { label: 'B5 (JIS)', detail: '182 × 257 mm', widthMm: 182, heightMm: 257 },
  A4: { label: 'A4', detail: '210 × 297 mm', widthMm: 210, heightMm: 297 },
  A5: { label: 'A5', detail: '148 × 210 mm', widthMm: 148, heightMm: 210 },
}

export interface PrintSettings {
  paper: PaperSize
  /** Open the print screen as soon as a sales order is saved */
  printOnSave: boolean
}

const KEY = 'invoice-print-settings'
const DEFAULTS: PrintSettings = { paper: 'B5', printOnSave: false }

export const loadPrintSettings = (): PrintSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<PrintSettings>
    return {
      paper: saved.paper && saved.paper in PAPER_SIZES ? saved.paper : DEFAULTS.paper,
      printOnSave: typeof saved.printOnSave === 'boolean' ? saved.printOnSave : DEFAULTS.printOnSave,
    }
  } catch {
    return DEFAULTS
  }
}

export const savePrintSettings = (settings: PrintSettings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private mode or blocked storage: the defaults apply next time
  }
}
