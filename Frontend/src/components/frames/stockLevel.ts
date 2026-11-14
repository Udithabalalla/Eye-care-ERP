import type { FrameVariant } from '@/types/frames.types'

export function stockLevel(variant: Pick<FrameVariant, 'current_stock' | 'reorder_level'>) {
  if (variant.current_stock === 0) return 'out'
  if (variant.current_stock <= variant.reorder_level) return 'low'
  return 'ok'
}
