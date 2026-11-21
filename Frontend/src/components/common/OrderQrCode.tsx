import { useMemo } from 'react'
import QRCode from 'qrcode'

// Four blank modules round the code: the quiet zone scanners need to find it
const QUIET_ZONE = 4

/**
 * A QR code of the order's ID, drawn as SVG so it prints sharp at any size.
 * Scanning it with Scan invoice on the Sales Orders page opens the order; the
 * ID is printed under it for typing in by hand.
 */
const OrderQrCode = ({
  value,
  className = 'text-black',
  codeClassName = 'size-24',
  labelClassName = 'text-[10px]',
}: {
  value: string
  /** Wrapper classes; the text colour also colours the code */
  className?: string
  codeClassName?: string
  labelClassName?: string
}) => {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
    // One square per dark module, as a single path (far smaller than one rect each)
    let d = ''
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }
    return { size: modules.size + QUIET_ZONE * 2, path: d }
  }, [value])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code ${value}`} className={codeClassName}>
        <rect width={size} height={size} fill="#fff" />
        <path d={path} fill="currentColor" />
      </svg>
      <p className={`font-mono font-semibold tracking-[0.12em] ${labelClassName}`}>{value}</p>
    </div>
  )
}

export default OrderQrCode
