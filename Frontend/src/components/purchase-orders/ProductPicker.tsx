import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine, RiCloseLine, RiLoader4Line } from '@remixicon/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { productsApi } from '@/api/products.api'
import { Product } from '@/types/product.types'
import { formatCurrency } from '@/utils/formatters'

interface ProductPickerProps {
  value?: Product | null
  onChange: (product: Product | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ProductPicker({
  value,
  onChange,
  placeholder = 'Search products…',
  disabled = false,
  className,
}: ProductPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['product-picker', search],
    queryFn: () => productsApi.getAll({ search: search || undefined, page: 1, page_size: 30 }),
    enabled: open,
    staleTime: 10_000,
  })
  const products = data?.data ?? []

  const handleSelect = useCallback(
    (p: Product) => {
      onChange(p)
      setOpen(false)
      setSearch('')
    },
    [onChange],
  )

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value ? value.name : placeholder}</span>
          {value && (
            <span
              role="button"
              className="ml-1 shrink-0 rounded p-0.5 hover:bg-muted"
              onClick={handleClear}
            >
              <RiCloseLine className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, category…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {isFetching && products.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <RiLoader4Line className="size-4 animate-spin" />
              Searching…
            </div>
          )}
          {!isFetching && products.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No products found.</p>
          )}
          {products.map((p) => (
            <button
              key={p.product_id}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
              onClick={() => handleSelect(p)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[p.category, p.brand].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs tabular-nums">{formatCurrency(p.cost_price)}</p>
                <p className="text-[10px] text-muted-foreground">{p.sku}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
