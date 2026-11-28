import { useState } from 'react'
import { RiCloseLine, RiFilter3Line, RiUserSearchLine } from '@remixicon/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { usePatientSearch } from '@/hooks/usePatientSearch'
import { CREATED_LABELS, type CreatedFilter, type InvoiceFilter } from './salesOrderCreatedRange'

export interface PatientChoice {
  id: string
  name: string
}

/** "Filter by patient": search patients by name or phone and list only their orders */
export function PatientFilter({ value, onChange }: { value: PatientChoice | null; onChange: (patient: PatientChoice | null) => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const { data, isFetching } = usePatientSearch(term)
  const patients = data?.data ?? []

  const trigger = (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn('max-w-56', value && 'border-primary/40 bg-primary/5 text-foreground')}
      >
        <RiUserSearchLine />
        <span className="truncate">{value ? value.name : 'Filter by patient'}</span>
      </Button>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {value ? (
        <ButtonGroup>
          {trigger}
          <Button variant="outline" size="icon-sm" aria-label="Show every patient's orders" onClick={() => onChange(null)} className="border-primary/40 bg-primary/5">
            <RiCloseLine />
          </Button>
        </ButtonGroup>
      ) : (
        trigger
      )}
      <PopoverContent align="end" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Patient name or phone…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>
              {!term.trim() ? 'Type a name or phone number' : isFetching ? 'Searching…' : 'No patients found'}
            </CommandEmpty>
            {patients.length > 0 && (
              <CommandGroup>
                {patients.map((patient) => (
                  <CommandItem
                    key={patient.patient_id}
                    value={patient.patient_id}
                    onSelect={() => {
                      onChange({ id: patient.patient_id, name: patient.name })
                      setOpen(false)
                      setTerm('')
                    }}
                  >
                    <span className="truncate">{patient.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{patient.phone}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

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
      <DropdownMenuContent align="end" className="w-52">
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
