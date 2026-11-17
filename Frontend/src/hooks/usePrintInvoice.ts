import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { companyProfileApi } from '@/api/company-profile.api'
import type { Invoice } from '@/types/invoice.types'
import { invoiceToPreviewData } from '@/utils/invoicePreview'
import { printInvoice } from '@/utils/printInvoice'

/** One-tap invoice printing: opens the device's print screen with the invoice, sized to the paper in Settings → Printing */
export const usePrintInvoice = () => {
  const queryClient = useQueryClient()
  const [printing, setPrinting] = useState(false)

  const print = useCallback(
    async (invoice: Invoice, { orderNumber }: { orderNumber?: string } = {}) => {
      setPrinting(true)
      try {
        const company = await queryClient
          .fetchQuery({ queryKey: ['company-profile'], queryFn: () => companyProfileApi.get(), staleTime: 10 * 60 * 1000 })
          .catch(() => undefined)
        const data = invoiceToPreviewData(invoice)
        await printInvoice({ ...data, salesOrderNumber: orderNumber || data.salesOrderNumber }, company)
      } catch {
        toast.error('Could not open the invoice for printing')
      } finally {
        setPrinting(false)
      }
    },
    [queryClient],
  )

  return { printInvoice: print, printing }
}
