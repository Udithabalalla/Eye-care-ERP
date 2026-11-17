import { code128Widths } from '@/utils/code128'

// Blank modules either side of the bars, so a scanner can find where the code starts
const QUIET_ZONE = 10

/**
 * Code 128 bars as SVG, one unit per module, stretched to the container's width.
 * Scanning it on the Sales Orders page (Find by receipt) opens the order.
 */
const OrderBarcode = ({ value, className = '' }: { value: string; className?: string }) => {
  const widths = code128Widths(value)
  if (!widths) return null
  const total = widths.reduce((sum, w) => sum + w, 0) + QUIET_ZONE * 2
  let x = QUIET_ZONE
  const bars = widths.flatMap((w, i) => {
    const bar = i % 2 === 0 ? [<rect key={i} x={x} y={0} width={w} height={1} />] : []
    x += w
    return bar
  })
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${total} 1`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Barcode ${value}`}
        className="block h-10 w-full fill-black"
      >
        {bars}
      </svg>
      <p className="mt-0.5 text-center font-mono text-[10px] font-semibold tracking-[0.12em] text-black">{value}</p>
    </div>
  )
}

export default OrderBarcode
