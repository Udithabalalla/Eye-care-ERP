import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RiCheckLine, RiRefreshLine } from '@remixicon/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
import InvoicePreview, { type InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import { companyProfileApi } from '@/api/company-profile.api'
import type { CompanyProfile, InvoiceAppearance } from '@/types/company-profile.types'
import {
  DEFAULT_INVOICE_APPEARANCE,
  INVOICE_ACCENTS,
  PAYMENT_TERMS,
  invoiceAppearanceOf,
  paymentTermsLabel,
} from '@/utils/invoiceAppearance'
import { localDateString } from '@/utils/formatters'

const schema = z.object({
  layout: z.enum(['classic', 'split', 'ledger']),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a colour'),
  typeface: z.enum(['sans', 'mono']),
  spacing: z.enum(['roomy', 'compact']),
  show_logo: z.boolean(),
  show_line_details: z.boolean(),
  show_discount: z.boolean(),
  show_tax: z.boolean(),
  show_notes: z.boolean(),
  show_payment_details: z.boolean(),
  payment_terms_days: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(30), z.literal(45), z.literal(60)]),
})
type Values = z.infer<typeof schema>

const LAYOUTS: Array<{ value: Values['layout']; label: string; description: string }> = [
  { value: 'classic', label: 'Classic', description: 'The Vision Opticals design: large title, coloured item header' },
  { value: 'split', label: 'Split', description: 'Invoice details and customer in a tinted panel beside your details' },
  { value: 'ledger', label: 'Ledger', description: 'Details listed on the right, ruled rows, outlined balance' },
]

const SHOW: Array<{ name: keyof Pick<Values, 'show_logo' | 'show_line_details' | 'show_discount' | 'show_tax' | 'show_notes' | 'show_payment_details'>; label: string; description: string }> = [
  { name: 'show_logo', label: 'Logo', description: 'The eye mark above the name' },
  { name: 'show_line_details', label: 'Line details', description: 'Type and code under each item' },
  { name: 'show_discount', label: 'Discount', description: 'Off: the subtotal is shown after the discount' },
  { name: 'show_tax', label: 'Tax', description: 'Your tax number and tax line. Off: prices include tax' },
  { name: 'show_notes', label: 'Notes', description: "The order's note to the customer" },
  { name: 'show_payment_details', label: 'Payment details', description: 'Each payment with its date. Off: one "Paid" line' },
]

/** A tiny drawing of each layout for the picker */
const LayoutThumb = ({ layout }: { layout: Values['layout'] }) => {
  const line = 'h-[3px] rounded-full bg-muted-foreground/30'
  return (
    <span aria-hidden className="flex h-14 w-full flex-col gap-[3px] rounded-[5px] border border-border bg-background p-1.5">
      {layout === 'classic' && (
        <>
          <span className="flex items-start justify-between">
            <span className="h-1 w-6 rounded-full bg-foreground/70" />
            <span className="size-2 rounded-full bg-muted-foreground/40" />
          </span>
          <span className={cn(line, 'w-10')} />
          <span className="mt-0.5 h-1 w-full rounded-[1px] bg-foreground/60" />
          <span className={line} />
          <span className={line} />
        </>
      )}
      {layout === 'split' && (
        <span className="grid flex-1 grid-cols-2 gap-1">
          <span className="flex flex-col gap-[3px]">
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              <span className={cn(line, 'w-4')} />
            </span>
            <span className={line} />
            <span className={cn(line, 'w-3/4')} />
          </span>
          <span className="flex flex-col gap-[3px] rounded-[3px] bg-muted p-0.5">
            <span className="h-1 w-5 rounded-full bg-foreground/70" />
            <span className={line} />
            <span className={cn(line, 'w-2/3')} />
          </span>
        </span>
      )}
      {layout === 'ledger' && (
        <>
          <span className="flex flex-col items-end gap-[3px]">
            <span className="h-1 w-6 rounded-full bg-foreground/70" />
            <span className={cn(line, 'w-8')} />
          </span>
          <span className="h-px w-full bg-foreground/60" />
          <span className={line} />
          <span className="h-[3px] w-full rounded-full bg-muted-foreground/15" />
          <span className="h-1 w-1/2 self-end rounded-full bg-foreground/60" />
        </>
      )}
    </span>
  )
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm font-medium text-foreground">{children}</p>
)

const segmentItem = 'h-8 flex-1 rounded-md px-3 text-sm font-normal text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs'

const InvoiceAppearanceSettings = () => {
  const queryClient = useQueryClient()
  const initialized = useRef(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULT_INVOICE_APPEARANCE })

  const { data: profile, isLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
  })

  // Fill the form once when the profile first arrives; later refetches don't overwrite edits
  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true
      form.reset(invoiceAppearanceOf(profile))
    }
  }, [profile, form])

  const saveMutation = useMutation({
    mutationFn: (appearance: InvoiceAppearance) => companyProfileApi.update({ invoice_appearance: appearance }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['company-profile'], saved)
      queryClient.invalidateQueries({ queryKey: ['company-profile'] })
      form.reset(invoiceAppearanceOf(saved))
      toast.success('Invoice appearance saved', { description: 'Invoices on screen, printed and as PDFs now use it.' })
    },
    onError: () => toast.error('Could not save the invoice appearance'),
  })

  const values = form.watch()
  const isDefault = (Object.keys(DEFAULT_INVOICE_APPEARANCE) as (keyof InvoiceAppearance)[]).every(
    (key) => values[key] === DEFAULT_INVOICE_APPEARANCE[key],
  )

  const resetToDefault = () => {
    const keys = Object.keys(DEFAULT_INVOICE_APPEARANCE) as (keyof Values)[]
    keys.forEach((key) => form.setValue(key, DEFAULT_INVOICE_APPEARANCE[key] as never, { shouldDirty: true }))
  }

  // A sample invoice with the shop's own details (and stand-ins where they're blank), so every
  // setting shows its effect
  const sample = useMemo<{ data: InvoicePreviewData; company: CompanyProfile }>(() => {
    const today = new Date()
    const issued = localDateString(today)
    return {
      data: {
        invoiceNumber: 'INV-2026-000123',
        salesOrderId: 'SO000123',
        issueDate: issued,
        dueDate: localDateString(addDays(today, values.payment_terms_days)),
        billTo: { name: 'Nimali Perera', phone: '077 123 4567', email: 'nimali@example.com' },
        lines: [
          { key: 'frame', name: 'Ray-Ban RB5154 Black', detail: 'FR-5154', type: 'Frame', qty: 1, unitPrice: 18000, discount: 0, total: 18000 },
          { key: 'lens', name: 'Single vision blue-cut', detail: 'LN-SV-BC', type: 'Lens', qty: 1, unitPrice: 9500, discount: 0, total: 9500 },
          { key: 'fitting', name: 'Fitting', type: 'Service', qty: 1, unitPrice: 500, discount: 0, total: 500 },
          { key: 'cleaner', name: 'Lens cleaner 60 ml', detail: 'LC-60', type: 'Product', qty: 1, unitPrice: 1000, discount: 100, total: 900 },
        ],
        subtotal: 28900,
        discount: 900,
        tax: 0,
        total: 28000,
        paid: 10000,
        balance: 18000,
        payments: [{ label: 'Advance payment', date: issued, amount: 10000, method: 'cash' }],
        notes: 'Collect after 5 pm. Bring the old pair for the frame check.',
      },
      company: {
        ...profile,
        address: profile?.address || 'No. 12, Main Street, Kandy',
        phone: profile?.phone || '081 222 3344',
        email: profile?.email || 'hello@visionopticals.lk',
        tax_number: profile?.tax_number || 'TIN-1234567',
        invoice_terms: profile?.invoice_terms || 'Goods once sold are not returnable.',
        invoice_appearance: values,
      },
    }
  }, [profile, values])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoice Appearance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How customer invoices look on screen, when printed and as PDFs. Changes show in the preview as you make them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetToDefault} disabled={isDefault || saveMutation.isPending}>
            <RiRefreshLine />
            Reset to default
          </Button>
          <Button
            type="submit"
            form="invoice-appearance-form"
            size="sm"
            disabled={!form.formState.isDirty || saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending && <Spinner />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Live preview on a dotted canvas */}
        <section
          aria-label="Preview"
          className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 bg-[radial-gradient(var(--border)_1px,transparent_1px)] p-4 [background-size:16px_16px] sm:p-8"
        >
          <div className="w-full max-w-[34rem]">
            {isLoading ? (
              <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-card">
                <Spinner />
              </div>
            ) : (
              <InvoicePreview data={sample.data} company={sample.company} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Sample invoice. Your own details appear where you've filled them in under Company Profile.</p>
        </section>

        {/* Settings panel */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent>
            <Form {...form}>
              <form
                id="invoice-appearance-form"
                onSubmit={form.handleSubmit((submitted) => saveMutation.mutate(submitted))}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="layout"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Layout</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(value) => value && field.onChange(value)}
                          className="grid w-full grid-cols-3 gap-2"
                          aria-label="Layout"
                        >
                          {LAYOUTS.map((layout) => (
                            <ToggleGroupItem
                              key={layout.value}
                              value={layout.value}
                              aria-label={layout.label}
                              title={layout.description}
                              className="h-auto flex-col gap-1.5 rounded-lg border border-transparent p-1.5 text-xs font-normal text-muted-foreground hover:bg-muted/60 data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-foreground"
                            >
                              <LayoutThumb layout={layout.value} />
                              {layout.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormDescription className="text-xs">
                        {LAYOUTS.find((layout) => layout.value === field.value)?.description}
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accent"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Accent</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={(field.value ?? "").toUpperCase()}
                          onValueChange={(value) => value && field.onChange(value)}
                          className="flex-wrap gap-2"
                          aria-label="Accent colour"
                        >
                          {INVOICE_ACCENTS.map((accent) => (
                            <ToggleGroupItem
                              key={accent.value}
                              value={accent.value.toUpperCase()}
                              aria-label={accent.name}
                              title={accent.name}
                              className="size-8 min-w-0 rounded-full p-0 text-white ring-offset-2 ring-offset-background hover:opacity-90 data-[state=on]:ring-2 data-[state=on]:ring-foreground/70"
                              style={{ backgroundColor: accent.value }}
                            >
                              {(field.value ?? "").toUpperCase() === accent.value.toUpperCase() && <RiCheckLine className="size-4" />}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="typeface"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Typeface</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(value) => value && field.onChange(value)} className="w-full gap-1 rounded-lg bg-muted p-1" aria-label="Typeface">
                          <ToggleGroupItem value="sans" className={segmentItem}>Sans</ToggleGroupItem>
                          <ToggleGroupItem value="mono" className={cn(segmentItem, 'font-mono')}>Mono</ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="spacing"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Spacing</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(value) => value && field.onChange(value)} className="w-full gap-1 rounded-lg bg-muted p-1" aria-label="Spacing">
                          <ToggleGroupItem value="roomy" className={segmentItem}>Roomy</ToggleGroupItem>
                          <ToggleGroupItem value="compact" className={segmentItem}>Compact</ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <SectionLabel>Show</SectionLabel>
                  {SHOW.map((item) => (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={item.name}
                      render={({ field }) => (
                        <FormItem className="flex-row items-start justify-between gap-3 space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-normal text-foreground">{item.label}</FormLabel>
                            <FormDescription className="text-xs">{item.description}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <Separator />

                <FormField
                  control={form.control}
                  name="payment_terms_days"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-foreground">Payment terms</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={String(field.value)}
                          onValueChange={(value) => value && field.onChange(Number(value))}
                          className="flex-wrap justify-start gap-1.5"
                          aria-label="Payment terms"
                        >
                          {PAYMENT_TERMS.map((days) => (
                            <ToggleGroupItem
                              key={days}
                              value={String(days)}
                              className="h-8 rounded-md border border-border px-2.5 text-sm font-normal text-muted-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
                            >
                              {paymentTermsLabel(days)}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormDescription className="text-xs">
                        {field.value === 0
                          ? 'New invoices are due when issued'
                          : `New invoices are due ${field.value} days after they're issued`}
                        , unless the order sets a full-payment date. Split and Ledger print the due date.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <div className="space-y-1">
                  <SectionLabel>Currency</SectionLabel>
                  <p className="text-sm text-muted-foreground">LKR, Sri Lankan rupee</p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default InvoiceAppearanceSettings
