import { RiFilter3Line } from '@remixicon/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CREATED_LABELS, type CreatedFilter, type InvoiceFilter } from './salesOrderCreatedRange'

/** "Filter": when orders were created, and whether they have an invoice yet */
export function OrderFilterMenu({ created, invoice, onCreatedChange, onInvoiceChange, compact }: {
  created: CreatedFilter
  invoice: InvoiceFilter
  onCreatedChange: (value: CreatedFilter) => void
  onInvoiceChange: (value: InvoiceFilter) => void
  /** Icon only, for narrower screens */
  compact?: boolean
}) {
  const active = Number(created !== 'any') + Number(invoice !== 'any')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn(active > 0 && 'text-primary')} aria-label="Filter orders">
          <RiFilter3Line />
          <span className={cn(compact && 'hidden 2xl:inline')}>Filter</span>
          {active > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
              {active}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" inverted={false}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Created</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={created} onValueChange={(value) => onCreatedChange(value as CreatedFilter)}>
          {(Object.keys(CREATED_LABELS) as CreatedFilter[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key} onSelect={(event) => event.preventDefault()}>
              {CREATED_LABELS[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Invoice</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={invoice} onValueChange={(value) => onInvoiceChange(value as InvoiceFilter)}>
          <DropdownMenuRadioItem value="any" onSelect={(event) => event.preventDefault()}>Any</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="yes" onSelect={(event) => event.preventDefault()}>Invoice generated</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="no" onSelect={(event) => event.preventDefault()}>No invoice yet</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {active > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onCreatedChange('any'); onInvoiceChange('any') }}>Clear filters</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
