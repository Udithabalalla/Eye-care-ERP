import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RiCloseLine } from '@remixicon/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { frameVariantsApi } from '@/api/frames.api'
import { FrameMaster } from '@/types/frames.types'

const RIM_TYPES = ['full', 'half', 'rimless']

/** Type a value and press Enter or comma to add it as a chip (composed: shadcn has no tag input) */
const ChipInput = ({
  values,
  onChange,
  placeholder,
  numeric,
  invalid,
  label,
}: {
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  numeric?: boolean
  invalid?: boolean
  label: string
}) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(',').map((p) => p.trim()).filter(Boolean)
    const valid = numeric ? parts.filter((p) => !Number.isNaN(Number(p))) : parts
    const next = [...values]
    valid.forEach((p) => { if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p) })
    onChange(next)
    setDraft('')
  }
  return (
    <div
      className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 aria-invalid:border-destructive"
      aria-invalid={invalid || undefined}
    >
      {values.map((value) => (
        <span key={value} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
          {value}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-4 rounded-sm p-0 hover:bg-background"
            onClick={() => onChange(values.filter((v) => v !== value))}
            aria-label={`Remove ${value}`}
          >
            <RiCloseLine className="size-3" />
          </Button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={draft}
        aria-label={label}
        placeholder={values.length ? '' : placeholder}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={add}
      />
    </div>
  )
}

const amount = (message: string) =>
  z.string().trim().refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), message)

const bulkSchema = z.object({
  colors: z.array(z.string()).min(1, 'Add at least one colour'),
  sizes: z.array(z.string()).min(1, 'Add at least one size'),
  rim_type: z.string(),
  cost_price: amount('Enter 0 or more'),
  selling_price: z.string().trim().refine((v) => Number(v) > 0, 'Enter the selling price'),
  reorder_level: amount('Enter 0 or more'),
})
type BulkValues = z.infer<typeof bulkSchema>

const defaultsFor = (master: FrameMaster | null): BulkValues => ({
  colors: [],
  sizes: master?.default_eye_size ? [String(master.default_eye_size)] : [],
  rim_type: 'full',
  cost_price: '',
  selling_price: '',
  reorder_level: '2',
})

/**
 * Create every colour × size combination of a frame model in one go.
 * Stock is added afterwards with Receive, so it lands in the movement log.
 */
export function BulkVariantDialog({
  master,
  open,
  onClose,
}: {
  master: FrameMaster | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const form = useForm<BulkValues>({ resolver: zodResolver(bulkSchema), defaultValues: defaultsFor(master), mode: 'onChange' })

  // Each opening starts fresh for that frame model
  useEffect(() => {
    if (open && master) form.reset(defaultsFor(master))
  }, [open, master, form])

  const colors = form.watch('colors')
  const sizes = form.watch('sizes')
  const combos = colors.length * sizes.length

  const mutation = useMutation({
    mutationFn: (values: BulkValues) =>
      frameVariantsApi.bulkCreate({
        frame_master_id: master!.frame_master_id,
        colors: values.colors,
        eye_sizes: values.sizes.map(Number),
        rim_type: values.rim_type,
        bridge_size: master?.default_bridge_size,
        temple_length: master?.default_temple_length,
        cost_price: Number(values.cost_price || 0),
        selling_price: Number(values.selling_price || 0),
        reorder_level: Number(values.reorder_level || 0),
      }),
    onSuccess: (created) => {
      toast.success(`${created.length} variant${created.length === 1 ? '' : 's'} added`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master', master?.frame_master_id] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not add variants'),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add colours & sizes{master ? ` — ${master.brand} ${master.model_code}` : ''}</DialogTitle>
          <DialogDescription>Every colour is created in every size. Add stock afterwards with Receive.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField control={form.control} name="colors" render={({ field, fieldState }) => (
              <FormItem className="gap-1.5">
                <FormLabel>Colours</FormLabel>
                <ChipInput
                  label="Colours"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  invalid={!!fieldState.error}
                  placeholder="e.g. Black, Tortoise, Blue — press Enter after each"
                />
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sizes" render={({ field, fieldState }) => (
              <FormItem className="gap-1.5">
                <FormLabel>Eye sizes (mm)</FormLabel>
                <ChipInput
                  label="Eye sizes"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  invalid={!!fieldState.error}
                  placeholder="e.g. 50, 52, 54"
                  numeric
                />
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField control={form.control} name="rim_type" render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>Rim type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{RIM_TYPES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="cost_price" render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>Cost price</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="selling_price" render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>Selling price *</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorder_level" render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>Reorder at</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {combos
                ? <>This creates <span className="font-semibold text-foreground">{combos} variant{combos === 1 ? '' : 's'}</span> ({colors.length} colour{colors.length === 1 ? '' : 's'} × {sizes.length} size{sizes.length === 1 ? '' : 's'}). Existing combinations are skipped.</>
                : 'Add at least one colour and one size.'}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!form.formState.isValid || mutation.isPending}>
                {mutation.isPending && <Spinner />}
                Add {combos || ''} variant{combos === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
