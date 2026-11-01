export const PX_PER_MM = 96 / 25.4

/**
 * Print a receipt shown in an iframe. The page is sized to the slip's own
 * length, so a roll printer stops (and cuts) right after the last line
 * instead of feeding a full A4 page of blank paper.
 */
export const printReceiptFrame = (frame: HTMLIFrameElement | null, widthMm: number) => {
  const win = frame?.contentWindow
  const doc = frame?.contentDocument
  if (!win || !doc?.body) return false
  const heightMm = Math.ceil(doc.body.scrollHeight / PX_PER_MM) + 2
  const pageSize = doc.getElementById('page-size')
  if (pageSize) pageSize.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`
  win.focus()
  win.print()
  return true
}

/** Open the print dialog for a PDF; falls back to a new tab where the browser can't print it in place */
export const printPdfBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  // Off screen rather than zero-sized: some browsers print a blank page from an empty frame
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0'
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, '_blank')
    }
    // The print dialog keeps its own copy; tidy up once it has had time to read the file
    setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  frame.src = url
  document.body.appendChild(frame)
}
