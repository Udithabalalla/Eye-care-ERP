import { RiHistoryLine } from '@remixicon/react'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import Loading from '@/components/common/Loading'
import { inventoryMovementsApi } from '@/api/erp.api'
import { FrameVariant } from '@/types/frames.types'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
}

const TYPE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  PURCHASE_IN: 'default',
  SALE_OUT: 'secondary',
  RETURN: 'outline',
  ADJUSTMENT: 'outline',
}

export function VariantHistoryDrawer({ open, onClose, variant }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['variant-movements', variant?.variant_id],
    queryFn: () => inventoryMovementsApi.getAll({
      page: 1,
      page_size: 50,
    }),
    enabled: open && !!variant,
    staleTime: 10_000,
  })

  // client-side filter by variant_id since the API may not support it per-variant
  const rows = (data?.data ?? []).filter((m) => m.variant_id === variant?.variant_id)

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] flex flex-col gap-0">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <RiHistoryLine className="size-5 text-primary" />
            Stock History
          </SheetTitle>
          <SheetDescription>
            All stock movements for this variant.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="py-4 space-y-1">
          <p className="font-semibold text-sm">
            {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code} — {variant.color} / {variant.eye_size}mm
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
            <span className="text-xs text-muted-foreground">Current: <strong>{variant.current_stock} units</strong></span>
          </div>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No stock movements recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.movement_id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {m.created_at ? format(new Date(m.created_at), 'dd MMM yy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_COLORS[m.movement_type] ?? 'outline'} className="text-xs">
                        {m.movement_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold tabular-nums text-sm ${
                        m.movement_type === 'SALE_OUT' ? 'text-destructive' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {m.movement_type === 'SALE_OUT' ? '-' : '+'}{Math.abs(m.quantity)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{m.reference_type}</span>
                        <span className="font-mono text-xs">{m.reference_id || '—'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
