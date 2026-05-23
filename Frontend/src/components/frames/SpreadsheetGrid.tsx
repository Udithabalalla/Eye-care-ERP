/**
 * Spreadsheet-style editable grid.
 * Keyboard-first: Tab = next cell, Enter = new row, Ctrl+D = duplicate row.
 */
import * as React from 'react'
import { useCallback, useRef, useEffect } from 'react'
import {
  RiAddLine, RiDeleteBinLine, RiFileCopyLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FrameVariant } from '@/types/frames.types'
import { VariantPicker } from './VariantPicker'
import { StockBadge } from './StockBadge'
import { formatCurrency } from '@/utils/formatters'

export interface SpreadsheetRow {
  id: string
  variant: FrameVariant | null
  qty: number
  cost_price: number
}

interface SpreadsheetGridProps {
  rows: SpreadsheetRow[]
  onChange: (rows: SpreadsheetRow[]) => void
  disabled?: boolean
  showCostPrice?: boolean
  className?: string
}

function makeEmptyRow(): SpreadsheetRow {
  return {
    id: crypto.randomUUID(),
    variant: null,
    qty: 1,
    cost_price: 0,
  }
}

export function SpreadsheetGrid({
  rows,
  onChange,
  disabled = false,
  showCostPrice = true,
  className,
}: SpreadsheetGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  const updateRow = useCallback((id: string, patch: Partial<SpreadsheetRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [rows, onChange])

  const addRow = useCallback(() => {
    onChange([...rows, makeEmptyRow()])
  }, [rows, onChange])

  const duplicateRow = useCallback((id: string) => {
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) return
    const dupe: SpreadsheetRow = { ...rows[idx], id: crypto.randomUUID() }
    const next = [...rows]
    next.splice(idx + 1, 0, dupe)
    onChange(next)
  }, [rows, onChange])

  const deleteRow = useCallback((id: string) => {
    const next = rows.filter((r) => r.id !== id)
    onChange(next.length ? next : [makeEmptyRow()])
  }, [rows, onChange])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        addRow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addRow, disabled])

  const totalCost = rows.reduce((sum, r) => sum + (r.qty || 0) * (r.cost_price || 0), 0)
  const totalQty = rows.reduce((sum, r) => sum + (r.qty || 0), 0)

  return (
    <div className={cn('space-y-0', className)} ref={gridRef}>
      {/* Header */}
      <div
        className={cn(
          'grid gap-2 px-3 py-2 bg-muted/50 border border-border rounded-t-md text-xs font-medium text-muted-foreground',
          showCostPrice ? 'grid-cols-[1fr_80px_110px_90px]' : 'grid-cols-[1fr_80px_90px]',
        )}
      >
        <span>Variant</span>
        <span>Qty</span>
        {showCostPrice && <span>Cost Price</span>}
        <span />
      </div>

      {/* Rows */}
      <div className="border-x border-border divide-y divide-border">
        {rows.map((row, idx) => (
          <SpreadsheetRowItem
            key={row.id}
            row={row}
            index={idx}
            disabled={disabled}
            showCostPrice={showCostPrice}
            onVariantChange={(v) => updateRow(row.id, {
              variant: v,
              cost_price: v?.cost_price ?? row.cost_price,
            })}
            onQtyChange={(qty) => updateRow(row.id, { qty })}
            onCostChange={(cost_price) => updateRow(row.id, { cost_price })}
            onDuplicate={() => duplicateRow(row.id)}
            onDelete={() => deleteRow(row.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border border-t-0 border-border rounded-b-md bg-muted/30 px-3 py-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={addRow}
          className="h-7 gap-1 text-xs"
        >
          <RiAddLine className="size-3.5" />
          Add row
          <span className="text-muted-foreground ml-1">Ctrl+Enter</span>
        </Button>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{totalQty} pcs</span>
          {showCostPrice && <span className="font-semibold text-foreground">{formatCurrency(totalCost)}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Individual row ───────────────────────────────────────────────────────────

interface RowProps {
  row: SpreadsheetRow
  index: number
  disabled: boolean
  showCostPrice: boolean
  onVariantChange: (v: FrameVariant | null) => void
  onQtyChange: (qty: number) => void
  onCostChange: (cost: number) => void
  onDuplicate: () => void
  onDelete: () => void
}

function SpreadsheetRowItem({
  row, index, disabled, showCostPrice,
  onVariantChange, onQtyChange, onCostChange, onDuplicate, onDelete,
}: RowProps) {
  return (
    <div
      className={cn(
        'grid gap-2 px-3 py-1.5 items-center group hover:bg-accent/30 transition-colors',
        showCostPrice ? 'grid-cols-[1fr_80px_110px_90px]' : 'grid-cols-[1fr_80px_90px]',
      )}
    >
      {/* Variant picker */}
      <VariantPicker
        value={row.variant}
        onChange={onVariantChange}
        disabled={disabled}
        showStock
        showPrice={false}
        placeholder="Pick variant or scan…"
      />

      {/* Qty */}
      <Input
        type="number"
        min={1}
        value={row.qty}
        onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
        disabled={disabled}
        className="h-8 text-sm text-center tabular-nums"
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !showCostPrice) {
            // Let natural tab flow to next row's variant picker
          }
        }}
      />

      {/* Cost price */}
      {showCostPrice && (
        <Input
          type="number"
          min={0}
          step={0.01}
          value={row.cost_price}
          onChange={(e) => onCostChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="h-8 text-sm tabular-nums"
        />
      )}

      {/* Row actions (visible on hover) */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onDuplicate}
          title="Duplicate row (Ctrl+D)"
          aria-label="Duplicate"
        >
          <RiFileCopyLine className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onDelete}
          aria-label="Delete row"
          className="text-destructive hover:text-destructive"
        >
          <RiDeleteBinLine className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export { makeEmptyRow }
