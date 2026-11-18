import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import InvoicePreview, { type InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import type { CompanyProfile } from '@/types/company-profile.types'
import { loadPrintSettings, type PaperSize } from '@/utils/printSettings'

const HOST_ID = 'invoice-print-host'
const STYLE_ID = 'invoice-print-style'
const LOGO = '/brand/logo-full.png'

let current: { root: Root; host: HTMLElement; style: HTMLStyleElement; timer?: number } | null = null

const cleanUp = () => {
  if (current) {
    window.clearTimeout(current.timer)
    current.root.unmount()
    current.host.remove()
    current.style.remove()
    current = null
  }
  // A copy left by an earlier instance of this module (a dev hot reload) would print twice
  document.getElementById(HOST_ID)?.remove()
  document.getElementById(STYLE_ID)?.remove()
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
  style.id = STYLE_ID
  style.textContent = `
@media screen { #${HOST_ID} { display: none; } }
@media print {
  /* No page margin: browsers print the page title, URL, date and page number in it,
     so without one they print none of that. The invoice brings its own margin. */
  @page { size: ${paper}; margin: 0; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; margin: 0 !important; }
  body > :not(#${HOST_ID}) { display: none !important; }
  #${HOST_ID} { display: block; padding: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #${HOST_ID} tr { break-inside: avoid; }
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
