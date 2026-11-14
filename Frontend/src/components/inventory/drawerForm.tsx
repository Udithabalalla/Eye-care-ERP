import type { UseFormReturn } from 'react-hook-form'
import { RiArrowDownCircleLine, RiCalendarLine, RiMoneyDollarCircleLine, RiStickyNoteLine, RiTruckLine } from '@remixicon/react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { formatCurrency } from '@/utils/formatters'
import type { Supplier } from '@/types/supplier.types'
import { costOr, toQty, type ReceiveValues } from './drawerFormSchema'

/*
 * Pieces shared by the stock drawers (receive, adjust, create PO): the section
 * layout, the summary rows and the quantity / cost rules.
 */

export function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 px-6 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

/** Small muted label used in the drawers, with a red star when required */
export function DrawerLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <FormLabel className="text-xs font-medium text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </FormLabel>
  )
}

// ── Receiving stock (frame variant or product) ───────────────────────────────

/** Quantity, cost, receipt info, supplier, notes and the running summary */
export function ReceiveFields({
  form,
  defaultCost,
  currentStock,
  suppliers,
}: {
  form: UseFormReturn<ReceiveValues>
  defaultCost: number
  currentStock: number
  suppliers: Supplier[]
}) {
  const values = form.watch()
  const qtyNum = toQty(values.qty)
  const effectiveCost = costOr(values.cost, defaultCost)

  return (
    <>
      <Section icon={RiArrowDownCircleLine} title="Receive Details">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="qty" render={({ field }) => (
            <FormItem className="gap-1.5">
              <DrawerLabel required>Qty Received</DrawerLabel>
              <FormControl>
                <Input type="number" min={1} placeholder="1" className="h-11 text-lg font-semibold" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="cost" render={({ field }) => (
            <FormItem className="gap-1.5">
              <DrawerLabel>Unit Cost</DrawerLabel>
              <FormControl>
                <Input type="number" step="0.01" min={0} placeholder={String(defaultCost)} {...field} />
              </FormControl>
              <FormDescription className="text-xs">Default: {formatCurrency(defaultCost)}</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {qtyNum > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-1 text-xs text-muted-foreground">After receiving</p>
            <p className="text-lg font-semibold tabular-nums">
              {currentStock} + {qtyNum} = <span className="text-success">{currentStock + qtyNum} units</span>
            </p>
          </div>
        )}
      </Section>

      <Section icon={RiCalendarLine} title="Receipt Info">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="intake_date" render={({ field }) => (
            <FormItem className="gap-1.5">
              <DrawerLabel required>Receipt Date</DrawerLabel>
              <FormControl><Input type="date" className="h-9" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="reference_no" render={({ field }) => (
            <FormItem className="gap-1.5">
              <DrawerLabel>Reference No.</DrawerLabel>
              <FormControl><Input placeholder="INV-001 / DO-2026-…" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
      </Section>

      <Section icon={RiTruckLine} title="Supplier">
        <FormField control={form.control} name="supplier_id" render={({ field }) => (
          <FormItem>
            <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
              <FormControl>
                <SelectTrigger className="w-full" aria-label="Supplier">
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.supplier_name}{s.company_name ? ` · ${s.company_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      </Section>

      <Section icon={RiStickyNoteLine} title="Notes">
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormControl><Input placeholder="Optional internal notes…" aria-label="Notes" {...field} /></FormControl>
          </FormItem>
        )} />
      </Section>

      <Section icon={RiMoneyDollarCircleLine} title="Summary">
        <Row label="Unit Cost">{formatCurrency(effectiveCost)}</Row>
        <Row label="Qty">{qtyNum} units</Row>
        <Row label="Total Value">
          <span className="text-base font-bold">{formatCurrency(effectiveCost * qtyNum)}</span>
        </Row>
        {values.reference_no && <Row label="Reference">{values.reference_no}</Row>}
      </Section>
    </>
  )
}
