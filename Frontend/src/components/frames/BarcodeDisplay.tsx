import { useEffect, useState } from 'react'
import { axiosInstance } from '@/api/axios'
import { cn } from '@/lib/utils'
import { RiLoader4Line } from '@remixicon/react'

interface BarcodeDisplayProps {
  variantId: string
  sku: string
  className?: string
  height?: number
}

export function BarcodeDisplay({ variantId, sku, className, height = 40 }: BarcodeDisplayProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    setError(false)
    setSrc(null)

    axiosInstance
      .get(`/frame-variants/${variantId}/barcode`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data)
        setSrc(objectUrl)
      })
      .catch(() => setError(true))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [variantId])

  if (error) {
    return (
      <span className={cn('font-mono text-xs text-muted-foreground', className)}>{sku}</span>
    )
  }

  if (!src) {
    return (
      <span className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <RiLoader4Line className="size-3 animate-spin" />
        {sku}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={sku}
      style={{ height }}
      className={cn('object-contain', className)}
    />
  )
}
