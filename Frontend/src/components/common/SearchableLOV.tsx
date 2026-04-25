import { useState } from 'react'
import { RiArrowDownSLine, RiCloseLine, RiCheckLine } from '@remixicon/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface LOVOption {
  value: string
  label: string
  subtitle?: string
}

interface SearchableLOVProps {
  options: LOVOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

const SearchableLOV = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  required = false,
}: SearchableLOVProps) => {
  const [open, setOpen] = useState(false)

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (optionValue: string) => {
    onChange(optionValue === value ? '' : optionValue)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal h-auto py-2',
              error && 'border-destructive ring-destructive/20',
              !selectedOption && 'text-muted-foreground'
            )}
          >
            <span className="flex-1 truncate text-left">
              {selectedOption ? (
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{selectedOption.label}</span>
                  {selectedOption.subtitle && (
                    <span className="text-xs text-muted-foreground">{selectedOption.subtitle}</span>
                  )}
                </span>
              ) : (
                placeholder
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {value && !disabled && (
                <RiCloseLine
                  className="size-4 text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                />
              )}
              <RiArrowDownSLine className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                    className="flex items-center gap-2"
                  >
                    <RiCheckLine className={cn('size-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      {option.subtitle && (
                        <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default SearchableLOV
