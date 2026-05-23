import { RiHistoryLine, RiBox3Line, RiArrowUpDownLine } from '@remixicon/react'
import { useQuery } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
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

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export function VariantHistoryDrawer({ open, onClose, variant }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['variant-movements', variant?.variant_id],
    queryFn: () => inventoryMovementsApi.getAll({ page: 1, page_size: 50 }),
    enabled: open && !!variant,
    staleTime: 10_000,
  })

  const rows = (data?.data ?? []).filter((m) => m.variant_id === variant?.variant_id)

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiHistoryLine className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">Stock History</SheetTitle>
              <p className="text-xs text-muted-foreground">All stock movements for this variant.</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            <Section icon={RiBox3Line} title="Variant">
              <Row label="Frame">
                {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code}
              </Row>
              <Row label="Variant">{variant.color} / {variant.eye_size}mm</Row>
              <Row label="SKU">
                <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
              </Row>
              <Row label="Current Stock">
                <span className="tabular-nums">{variant.current_stock} units</span>
              </Row>
            </Section>

            <Section icon={RiArrowUpDownLine} title={`Movements (${rows.length})`}>
              {isLoading ? (
                <div className="py-8"><Loading /></div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No stock movements recorded yet.</p>
              ) : (
                <div className="-mx-2 overflow-x-auto">
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
                </div>
              )}
            </Section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
