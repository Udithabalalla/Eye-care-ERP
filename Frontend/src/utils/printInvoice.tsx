import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import InvoicePreview, { type InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import type { CompanyProfile } from '@/types/company-profile.types'
import { PAPER_SIZES, loadPrintSettings, type PaperSize } from '@/utils/printSettings'

const HOST_ID = 'invoice-print-host'
const STYLE_ID = 'invoice-print-style'
const LOGO = '/brand/logo-full.png'
const PAGE_MARGIN_MM = 10
const PX_PER_MM = 96 / 25.4
// The invoice is designed for A5's printable width; other papers scale the whole page
const DESIGN_WIDTH_MM = 148 - PAGE_MARGIN_MM * 2
// Shrink a long invoice to fit one page, but no further than this: past it the text
// gets too small to read, and the rest goes onto a second page instead
const MIN_SCALE = 0.7

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
 * Scale the invoice to the paper. It is designed for A5, so on wider paper (B5, A4) the
 * whole page is zoomed up to fill the width, keeping its proportions. If it then comes out
 * taller than the page, it is zoomed down just enough to fit (zoom, unlike transform, also
 * changes the space it takes, so the browser paginates the scaled size). The layout width
 * is adjusted by the same factor, so the zoomed copy always spans the page width.
 */
const fitToPage = (host: HTMLElement, body: HTMLElement, paper: PaperSize) => {
  const { widthMm, heightMm } = PAPER_SIZES[paper]
  const contentWidth = widthMm - PAGE_MARGIN_MM * 2
  // A little slack: browsers round page heights, and a 1 px overflow is a blank second page
  const contentHeight = heightMm - PAGE_MARGIN_MM * 2 - 2

  // Visible to layout but not on screen, for the measurement only
  host.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;visibility:hidden'
  const heightAt = (widthMmNow: number) => {
    body.style.width = `${widthMmNow}mm`
    return body.getBoundingClientRect().height / PX_PER_MM
  }

  let scale = contentWidth / DESIGN_WIDTH_MM
  // Narrower text wraps more, so the height depends on the width; a few passes settle it
  for (let pass = 0; pass < 3; pass++) {
    const scaledHeight = heightAt(contentWidth / scale) * scale
    if (scaledHeight <= contentHeight) break
    scale = Math.max(MIN_SCALE, scale * (contentHeight / scaledHeight))
    if (scale === MIN_SCALE) break
  }

  host.style.cssText = ''
  body.style.width = `${contentWidth / scale}mm`
  // A short invoice still fills the page, so its footer sits at the foot like the design
  body.style.minHeight = `${contentHeight / scale}mm`
  body.style.setProperty('zoom', String(scale))
}

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

  const body = document.createElement('div')
  host.appendChild(body)
  const root = createRoot(body)
  flushSync(() => root.render(<InvoicePreview data={data} company={company} printable />))
  current = { root, host, style }

  // Measure with the real fonts and logo in place
  await Promise.all([logoReady(), document.fonts?.ready])
  fitToPage(host, body, paper)
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
