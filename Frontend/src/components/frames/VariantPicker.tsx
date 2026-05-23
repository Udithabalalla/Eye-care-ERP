import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RiSearchLine, RiQrCodeLine, RiCloseLine, RiLoader4Line,
} from '@remixicon/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'
import { StockBadge } from './StockBadge'
import { formatCurrency } from '@/utils/formatters'
import QRScanner from '@/components/common/QRScanner'

interface VariantPickerProps {
  value?: FrameVariant | null
  onChange: (variant: FrameVariant | null) => void
  placeholder?: string
  disabled?: boolean
  showStock?: boolean
  showPrice?: boolean
  className?: string
}

export function VariantPicker({
  value,
  onChange,
  placeholder = 'Search brand, model, color, SKU or scan…',
  disabled = false,
  showStock = true,
  showPrice = true,
  className,
}: VariantPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [scannerOpen, setScannerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['variant-picker', open, search, page],
    queryFn: () => frameVariantsApi.getAll({ search: search || undefined, page, page_size: 20 }),
    enabled: open,
    staleTime: 10_000,
  })
  const variants = data?.data ?? []
  const totalPages = data?.total_pages ?? 1

  const handleSelect = useCallback((v: FrameVariant) => {
    onChange(v)
    setOpen(false)
    setSearch('')
    setPage(1)
  }, [onChange])

  const handleScan = useCallback(async (code: string) => {
    setScannerOpen(false)
    try {
      const variant = await frameVariantsApi.scanLookup(code)
      onChange(variant)
    } catch {
      // not found — open picker with scanned code pre-filled
      setSearch(code)
      setOpen(true)
    }
  }, [onChange])

  const handleClear = useCallback(() => {
    onChange(null)
    setSearch('')
    setPage(1)
  }, [onChange])

  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch)
    setPage(1)
  }

  return (
    <>
      <div className={cn('flex gap-2', className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                open && 'ring-2 ring-ring ring-offset-2',
              )}
              onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            >
              {value ? (
                <span className="flex items-center gap-2 text-left">
                  <span className="font-medium">
                    {value.frame_master_ref.brand} {value.frame_master_ref.model_code}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {value.color} / {value.eye_size} / {value.rim_type}
                  </span>
                  {showStock && (
                    <StockBadge stock={value.current_stock} reorderLevel={value.reorder_level} showCount={false} />
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent className="w-[480px] p-0" align="start">
            <div className="flex items-center border-b px-3">
              <RiSearchLine className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => updateSearch(e.target.value)}
                placeholder={placeholder}
                className="border-0 shadow-none focus-visible:ring-0 h-10"
              />
              {isFetching && <RiLoader4Line className="size-4 shrink-0 animate-spin text-muted-foreground" />}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {!isFetching && variants.length === 0 && search.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">No variants available</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add a frame variant or try again after syncing the catalogue.</p>
                </div>
              )}
              {search.length === 0 && variants.length > 0 && (
                <div className="border-b bg-muted/30 px-3 py-2">
                  <p className="text-xs font-medium text-foreground">
                    Showing page {page} of {totalPages}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Browse the catalog now or type to narrow results.
                  </p>
                </div>
              )}
              {search.length === 0 && variants.length === 0 && isFetching && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading variants…
                </p>
              )}
              {search.length > 0 && variants.length === 0 && !isFetching && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No variants found for "{search}"
                </p>
              )}
              {variants.map((v) => (
                <button
                  key={v.variant_id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  onClick={() => handleSelect(v)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {v.frame_master_ref.brand} {v.frame_master_ref.model_code}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.color} · {v.eye_size}mm · {v.rim_type} · <span className="font-mono">{v.sku}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {showStock && (
                      <StockBadge stock={v.current_stock} reorderLevel={v.reorder_level} />
                    )}
                    {showPrice && (
                      <span className="text-xs font-semibold">{formatCurrency(v.selling_price)}</span>
                    )}
                  </div>
                </button>
              ))}

              <div className="flex items-center justify-between border-t px-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages || isFetching}
                >
                  Next
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Scan button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => setScannerOpen(true)}
          aria-label="Scan barcode"
        >
          <RiQrCodeLine className="size-4" />
        </Button>

        {/* Clear button */}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            <RiCloseLine className="size-4" />
          </Button>
        )}
      </div>

      <QRScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </>
  )
}
