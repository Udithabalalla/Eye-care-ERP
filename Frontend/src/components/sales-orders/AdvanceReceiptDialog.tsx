import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiPrinterLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { companyProfileApi } from '@/api/company-profile.api'
import { useAuth } from '@/hooks/useAuth'
import type { Invoice } from '@/types/invoice.types'
import { PX_PER_MM, printReceiptFrame } from '@/utils/print'
import { buildAdvanceReceiptDocument, invoiceToAdvanceReceipt, type ReceiptPaperWidth } from './AdvanceReceipt'

const WIDTH_KEY = 'receipt-paper-width'

const loadWidth = (): ReceiptPaperWidth => {
  try {
    return localStorage.getItem(WIDTH_KEY) === '58' ? 58 : 80
  } catch {
    return 80
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  orderNumber?: string
  readyDate?: string
}

/**
 * Preview and print the small slip handed over when a customer pays an
 * advance. The preview is the printout itself (same page in an iframe), so
 * what staff check on screen is exactly what comes out of the printer.
 */
export function AdvanceReceiptDialog({ open, onOpenChange, invoice, orderNumber, readyDate }: Props) {
  const { user } = useAuth()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [width, setWidth] = useState<ReceiptPaperWidth>(loadWidth)
  const [frameHeight, setFrameHeight] = useState(480)

  const { data: company } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => companyProfileApi.get(),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  })

  const html = useMemo(
    () =>
      open
        ? buildAdvanceReceiptDocument(invoiceToAdvanceReceipt(invoice, { orderNumber, readyDate, issuedBy: user?.name }), company, width)
        : '',
    [open, invoice, orderNumber, readyDate, user?.name, company, width],
  )

  const changeWidth = (value: string) => {
    const next: ReceiptPaperWidth = value === '58' ? 58 : 80
    setWidth(next)
    try {
      localStorage.setItem(WIDTH_KEY, String(next))
    } catch {
      // remembering the width is only a convenience
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiPrinterLine className="size-5 text-primary" />
            Advance receipt
          </DialogTitle>
          <DialogDescription>
            A small slip for the receipt printer. The customer brings it back to pay the balance — the full receipt prints once the order is paid.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Paper width</span>
          <Tabs value={String(width)} onValueChange={changeWidth}>
            <TabsList>
              <TabsTrigger value="80">80 mm</TabsTrigger>
              <TabsTrigger value="58">58 mm</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Paper on a dark backing, like the slip coming out of the printer */}
        <div className="flex justify-center rounded-lg bg-muted p-4">
          <iframe
            ref={frameRef}
            title="Advance receipt preview"
            srcDoc={html}
            // A few spare pixels: the slip measures in fractions of a pixel and must not get scrollbars
            onLoad={(e) => setFrameHeight((e.currentTarget.contentDocument?.documentElement.scrollHeight ?? 480) + 4)}
            className="block bg-white shadow-md"
            style={{ width: Math.ceil(width * PX_PER_MM) + 2, height: frameHeight, border: 0 }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          In the print window, pick the receipt printer and set margins to <span className="font-medium text-foreground">None</span>.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="gap-2" onClick={() => printReceiptFrame(frameRef.current, width)} disabled={!html}>
            <RiPrinterLine className="size-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
