import { useEffect, useRef } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  RiAddLine,
  RiArrowDownCircleLine,
  RiDeleteBinLine,
  RiEditLine,
  RiEqualizer2Line,
  RiHistoryLine,
  RiLoader4Line,
  RiMore2Line,
  RiPrinterLine,
  RiShoppingCartLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DrawerLoadingBar, DrawerSection } from '@/components/common/DetailDrawer'
import { StockBadge } from '@/components/frames/StockBadge'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameMaster, FrameVariant } from '@/types/frames.types'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatters'

export interface FrameModelActions {
  onReceive: (v: FrameVariant) => void
  onCount: (v: FrameVariant) => void
  onReorder: (v: FrameVariant) => void
  onHistory: (v: FrameVariant) => void
  onEditVariant: (v: FrameVariant) => void
  onDeleteVariant: (v: FrameVariant) => void
  onPrintLabels: (variants: FrameVariant[]) => void
  onAddVariants: (m: FrameMaster) => void
  onAddOne: (m: FrameMaster) => void
  onEditModel: (m: FrameMaster) => void
  onDeleteModel: (m: FrameMaster) => void
}

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'bad' }) => (
  <div className="px-3 py-2.5">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn('text-sm font-semibold tabular-nums', tone === 'warn' && 'text-amber-600 dark:text-amber-400', tone === 'bad' && 'text-destructive')}>
      {value}
    </p>
  </div>
)

/**
 * A frame model with every colour/size it comes in, and the stock actions for
 * each — always visible, no hover. Switching models swaps the content in place.
 */
export function FrameModelDrawer({
  master,
  open,
  onOpenChange,
  highlightVariantId,
  actions,
}: {
  master: FrameMaster | null
  open: boolean
  onOpenChange: (open: boolean) => void
  highlightVariantId?: string | null
  actions: FrameModelActions
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  const { data: variants, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['frame-variants-for-master', master?.frame_master_id],
    queryFn: () => frameVariantsApi.getForMaster(master!.frame_master_id),
    enabled: open && !!master,
    placeholderData: keepPreviousData,
  })
  const isSwitching = isFetching && isPlaceholderData
  const list = variants ?? []

  // Start at the top for a new model; bring a scanned / picked variant into view
  useEffect(() => {
    if (!highlightVariantId) bodyRef.current?.scrollTo({ top: 0 })
  }, [master?.frame_master_id, highlightVariantId])
  useEffect(() => {
    if (!highlightVariantId || isSwitching) return
    bodyRef.current?.querySelector(`[data-variant-id="${highlightVariantId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlightVariantId, isSwitching, list.length])

  const inStock = list.reduce((sum, v) => sum + v.current_stock, 0)
  const needReorder = list.filter((v) => v.current_stock <= v.reorder_level).length
  const outOfStock = list.filter((v) => v.current_stock === 0).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="flex-shrink-0 space-y-1 border-b px-5 pb-4 pt-5">
          <SheetTitle className="pr-20 text-base font-semibold text-foreground">
            {master ? `${master.brand} ${master.model_code}` : '…'}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {master && <Badge variant="secondary" className="capitalize">{master.category}</Badge>}
              {master?.frame_name && master.frame_name !== `${master.brand} ${master.model_code}` && <span>{master.frame_name}</span>}
              {[master?.shape, master?.material, master?.gender].filter(Boolean).map((part) => (
                <span key={part} className="capitalize">· {part}</span>
              ))}
            </div>
          </SheetDescription>
        </SheetHeader>
        <DrawerLoadingBar active={isSwitching} />

        <div ref={bodyRef} className={cn('custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity', isSwitching && 'opacity-60')}>
          {!master ? null : (
            <>
              <div className="border-b px-5 py-4">
                <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
                  <Stat label="Variants" value={list.length} />
                  <Stat label="In stock" value={inStock} />
                  <Stat label={outOfStock ? `Need reorder (${outOfStock} out)` : 'Need reorder'} value={needReorder} tone={outOfStock ? 'bad' : needReorder ? 'warn' : undefined} />
                </div>
              </div>

              <DrawerSection title={`Colours & sizes (${list.length})`}>
                {isFetching && !list.length ? (
                  <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RiLoader4Line className="size-4 animate-spin" /> Loading…
                  </div>
                ) : list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <p className="text-sm font-medium">No variants yet</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Add the colours and sizes this model comes in.</p>
                    <Button size="sm" className="mt-3 gap-1.5" onClick={() => actions.onAddVariants(master)}>
                      <RiAddLine className="size-4" />Add colours & sizes
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {list.map((v) => (
                      <li
                        key={v.variant_id}
                        data-variant-id={v.variant_id}
                        className={cn('-mx-2 rounded-lg px-2 py-2.5 transition-colors', v.variant_id === highlightVariantId && 'bg-primary/5 ring-1 ring-primary/30')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {v.color} <span className="font-normal text-muted-foreground">· {v.eye_size} mm</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span className="font-mono">{v.sku}</span>
                              {[v.bridge_size && `bridge ${v.bridge_size}`, v.temple_length && `arm ${v.temple_length}`, v.rim_type].filter(Boolean).map((part) => ` · ${part}`)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium tabular-nums">{formatCurrency(v.selling_price)}</p>
                            <StockBadge stock={v.current_stock} reorderLevel={v.reorder_level} />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => actions.onReceive(v)}>
                            <RiArrowDownCircleLine className="size-3.5" />Receive
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => actions.onCount(v)}>
                            <RiEqualizer2Line className="size-3.5" />Count
                          </Button>
                          {v.current_stock <= v.reorder_level && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-amber-700 dark:text-amber-400" onClick={() => actions.onReorder(v)}>
                              <RiShoppingCartLine className="size-3.5" />Reorder
                            </Button>
                          )}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0" aria-label={`More actions for ${v.color} ${v.eye_size}`}>
                                <RiMore2Line className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {v.current_stock > v.reorder_level && (
                                <DropdownMenuItem onClick={() => actions.onReorder(v)}><RiShoppingCartLine className="size-4" />Reorder</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => actions.onPrintLabels([v])}><RiPrinterLine className="size-4" />Print label</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => actions.onHistory(v)}><RiHistoryLine className="size-4" />Stock history</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => actions.onEditVariant(v)}><RiEditLine className="size-4" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDeleteVariant(v)}>
                                <RiDeleteBinLine className="size-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </DrawerSection>
            </>
          )}
        </div>

        {master && (
          <div className="flex flex-shrink-0 gap-2 border-t bg-background px-5 py-3">
            <Button className="flex-1 gap-1.5" onClick={() => actions.onAddVariants(master)}>
              <RiAddLine className="size-4" />Add colours & sizes
            </Button>
            <Button variant="outline" className="gap-1.5" disabled={!list.length} onClick={() => actions.onPrintLabels(list)}>
              <RiPrinterLine className="size-4" />Labels
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5" aria-label="More model actions">
                  <RiMore2Line className="size-4" />More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48">
                <DropdownMenuItem onClick={() => actions.onAddOne(master)}><RiAddLine className="size-4" />Add one variant</DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onEditModel(master)}><RiEditLine className="size-4" />Edit model</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDeleteModel(master)}>
                  <RiDeleteBinLine className="size-4" />Delete model
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
