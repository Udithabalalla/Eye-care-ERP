import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '@/api/erp.api'

/** Query for an invoice's payments; under ['payments'], so recording a payment refreshes it */
export const invoicePaymentsQuery = (invoiceId: string) => ({
  queryKey: ['payments', 'invoice', invoiceId],
  queryFn: async () => (await paymentsApi.getAll({ reference_type: 'INVOICE', reference_id: invoiceId, page: 1, page_size: 100 })).data,
})

/** The payments recorded against an invoice (the advance included), for the drawers and the printout */
export const useInvoicePayments = (invoiceId?: string | null, enabled = true) =>
  useQuery({ ...invoicePaymentsQuery(invoiceId ?? ''), enabled: enabled && !!invoiceId })
