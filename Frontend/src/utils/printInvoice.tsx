import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import InvoicePreview, { type InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import type { CompanyProfile } from '@/types/company-profile.types'
import { loadPrintSettings, type PaperSize } from '@/utils/printSettings'

const HOST_ID = 'invoice-print-host'
const LOGO = '/brand/logo-full.png'

let current: { root: Root; host: HTMLElement; style: HTMLStyleElement; timer?: number } | null = null

const cleanUp = () => {
  if (!current) return
  window.clearTimeout(current.timer)
  current.root.unmount()
  current.host.remove()
  current.style.remove()
  current = null
}

// The logo is a CSS mask; make sure it has loaded, or the first print comes out without it
const logoReady = () =>
  new Promise<void>((resolve) => {
    const img = new Image()
    const done = () => resolve()
    img.onload = done
    img.onerror = done
    window.setTimeout(done, 1500)
    img.src = LOGO
  })

/**
 * Print the invoice on this page rather than as a PDF: Android Chrome can't
 * print a PDF from inside the page, but prints HTML straight to the tablet's
 * printer. Everything else on the page is hidden for print, and the page is
 * sized to the paper chosen under Settings → Printing.
 */
export const printInvoice = async (
  data: InvoicePreviewData,
  company?: CompanyProfile,
  paper: PaperSize = loadPrintSettings().paper,
) => {
  cleanUp()

  const style = document.createElement('style')
  style.textContent = `
@media screen { #${HOST_ID} { display: none; } }
@media print {
  @page { size: ${paper}; margin: 10mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > :not(#${HOST_ID}) { display: none !important; }
  #${HOST_ID} { display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`
  const host = document.createElement('div')
  host.id = HOST_ID
  document.head.appendChild(style)
  document.body.appendChild(host)

  const root = createRoot(host)
  flushSync(() => root.render(<InvoicePreview data={data} company={company} printable />))
  current = { root, host, style }

  await logoReady()
  window.print()

  // Android opens its print screen without waiting, so keep the copy in place for a
  // while after afterprint; the next print replaces it anyway
  const scheduled = current
  window.addEventListener(
    'afterprint',
    () => {
      if (current === scheduled) current.timer = window.setTimeout(cleanUp, 60_000)
    },
    { once: true },
  )
}
