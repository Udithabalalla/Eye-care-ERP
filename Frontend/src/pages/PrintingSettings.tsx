import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RiPrinterLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { companyProfileApi } from '@/api/company-profile.api'
import type { InvoicePreviewData } from '@/components/sales-orders/InvoicePreview'
import { printInvoice } from '@/utils/printInvoice'
import { PAPER_SIZES, loadPrintSettings, savePrintSettings, type PaperSize } from '@/utils/printSettings'

const schema = z.object({
  paper: z.enum(Object.keys(PAPER_SIZES) as [PaperSize, ...PaperSize[]]),
  printOnSave: z.boolean(),
})
type Values = z.infer<typeof schema>

const today = new Date().toISOString().slice(0, 10)

// A made-up invoice for the test print, so the printer can be checked without a real order
const SAMPLE: InvoicePreviewData = {
  invoiceNumber: 'TEST-PRINT',
  salesOrderNumber: 'SO-TEST',
  salesOrderId: 'SO000000',
  issueDate: today,
  dueDate: today,
  billTo: { name: 'Test customer', phone: '077 000 0000' },
  lines: [
    { key: 'frame', name: 'Sample frame', detail: 'FRM-001', type: 'Frame', qty: 1, unitPrice: 12500, discount: 0, total: 12500 },
    { key: 'lens', name: 'Sample lenses', detail: 'Single vision', type: 'Lens', qty: 2, unitPrice: 4500, discount: 0, total: 9000 },
  ],
  subtotal: 21500,
  discount: 0,
  total: 21500,
  paid: 10000,
  balance: 11500,
  notes: 'Test print from Settings → Printing',
}

const SETUP_STEPS = [
  'Connect the tablet to the same WiFi network as the printer.',
  "On the tablet, open Settings → Connected devices → Connection preferences → Printing, and turn on the printer's print service (Default Print Service, Mopria, or the printer maker's plugin from the Play Store).",
  'Below, choose the paper the printer is loaded with and tap Save.',
  'Tap Print a test page. In the print screen choose the WiFi printer and the same paper size, then tap the print button. The tablet remembers both for next time.',
]

/**
 * One-time printer setup for this device. Print invoice buttons then open the
 * print screen with the invoice laid out for this paper.
 */
const PrintingSettings = () => {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: loadPrintSettings() })
  const [testing, setTesting] = useState(false)

  const { data: company } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
  })

  const save = (values: Values) => {
    savePrintSettings(values)
    form.reset(values)
    toast.success('Printing settings saved on this device')
  }

  const testPrint = async () => {
    setTesting(true)
    try {
      await printInvoice(SAMPLE, company, form.getValues('paper'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Printing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up this device once to print invoices to the shop's WiFi printer. These settings are saved on this device only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice printing</CardTitle>
          <CardDescription>Used by every Print invoice button on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save)} className="space-y-5">
              <FormField
                control={form.control}
                name="paper"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paper size</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full sm:w-72">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(PAPER_SIZES) as PaperSize[]).map((size) => (
                          <SelectItem key={size} value={size}>
                            {PAPER_SIZES[size].label} · {PAPER_SIZES[size].detail}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Pick the same size in the print screen the first time you print.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="printOnSave"
                render={({ field }) => (
                  <FormItem className="flex-row items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="space-y-1">
                      <FormLabel>Print as soon as an order is saved</FormLabel>
                      <FormDescription>
                        Opens the print screen with the invoice right after a sales order is created, so staff only tap print.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!form.formState.isDirty}>
                  Save
                </Button>
                <Button type="button" variant="outline" className="gap-1.5" onClick={testPrint} disabled={testing}>
                  {testing ? <Spinner /> : <RiPrinterLine className="size-4" />}
                  Print a test page
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set up the WiFi printer on the tablet</CardTitle>
          <CardDescription>Do this once on each tablet or phone that prints.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {SETUP_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Web pages can't print without the print screen, so printing takes two taps: Print invoice, then the print button.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default PrintingSettings
