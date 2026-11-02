import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RiBarcodeLine, RiCameraLine, RiLoader4Line, RiSearchLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import QRScanner from '@/components/common/QRScanner'
import { salesOrdersApi } from '@/api/erp.api'

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Scan the barcode or type the code printed under it')
    .regex(/^[A-Za-z0-9-]+$/, "That doesn't look like an order code"),
})

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the order's ID once the scanned code matches an order */
  onFound: (orderId: string) => void
}

/**
 * Finds an order from the barcode on its advance receipt. A USB scanner types
 * the code into the field and presses Enter; the camera button covers phones
 * and tablets.
 */
export function FindOrderByReceiptDialog({ open, onOpenChange, onFound }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } })

  const close = () => {
    form.reset()
    onOpenChange(false)
  }

  const onSubmit = async ({ code }: Values) => {
    const orderId = code.toUpperCase()
    try {
      const order = await salesOrdersApi.getById(orderId)
      onFound(order.order_id)
      close()
    } catch {
      form.setError('code', { message: `No sales order found for ${orderId}` })
      form.setFocus('code')
    }
  }

  return (
    <>
      <Dialog open={open && !cameraOpen} onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RiBarcodeLine className="size-5 text-primary" />
              Find order from receipt
            </DialogTitle>
            <DialogDescription>Scan the barcode on the advance receipt to open its sales order.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form id="find-order-by-receipt" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. SO000123" autoFocus autoComplete="off" className="font-mono uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setCameraOpen(true)}>
                <RiCameraLine className="size-4" />
                Use the camera instead
              </Button>
            </form>
          </Form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" form="find-order-by-receipt" className="gap-2" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <RiLoader4Line className="size-4 animate-spin" /> : <RiSearchLine className="size-4" />}
              Find order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QRScanner
        isOpen={open && cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(text) => {
          setCameraOpen(false)
          form.setValue('code', text.trim(), { shouldValidate: true })
          form.handleSubmit(onSubmit)()
        }}
      />
    </>
  )
}
