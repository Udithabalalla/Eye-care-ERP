import { cn } from '@/lib/utils'

interface SparklineProps {
  values: number[]
  className?: string
  /** Colour of the dot on the latest value (a text-* class); the line is muted */
  dotClassName?: string
  /** What the line shows, read out instead of the drawing */
  label: string
}

const WIDTH = 96
const HEIGHT = 32
const PAD = 3

/** A small trend line with a dot on its latest value, for a figure in a KPI strip */
export function Sparkline({ values, className, dotClassName = 'text-primary', label }: SparklineProps) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = PAD + (index / (values.length - 1)) * (WIDTH - PAD * 2)
    // A flat line sits low, like the start of a rise
    const y = max === min ? HEIGHT - PAD - 2 : HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2)
    return [x, y] as const
  })
  const [lastX, lastY] = points[points.length - 1]
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn('h-8 w-24 overflow-visible', className)}
      role="img"
      aria-label={label}
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-muted-foreground/60"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" className={dotClassName} />
    </svg>
  )
}

export default Sparkline
