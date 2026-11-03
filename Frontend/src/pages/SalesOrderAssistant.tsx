import { RiArrowLeftSLine } from '@remixicon/react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { salesOrdersApi } from '@/api/erp.api'
import { Button } from '@/components/ui/button'
import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { Patient } from '@/types/patient.types'

const SalesOrderAssistant = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const draftOrderId = searchParams.get('draft') || undefined
  const reorderFromId = searchParams.get('reorder') || undefined
  const initialPatient: Patient | undefined = location.state?.patient
  // Same query as the form, so this reads its cache rather than fetching again
  const { data: draftOrder } = useQuery({
    queryKey: ['sales-order-draft', draftOrderId],
    queryFn: () => salesOrdersApi.getById(draftOrderId!),
    enabled: !!draftOrderId,
    staleTime: Infinity,
  })
  const isEditingOrder = !!draftOrder && draftOrder.status !== 'draft'

  const title = isEditingOrder
    ? `Edit Order — ${draftOrder.order_number}`
    : draftOrderId
    ? 'Continue Draft Order'
    : reorderFromId
      ? 'Reorder'
      : initialPatient
        ? `New Order — ${initialPatient.name}`
        : 'New Sales Order'

  const subtitle = isEditingOrder
    ? 'Change any step, then save on Review & Pay.'
    : draftOrderId
    ? 'Pick up where you left off and complete this draft.'
    : reorderFromId
      ? 'Pre-filled from a previous order — review and confirm details.'
      : initialPatient
        ? 'Patient pre-filled — continue from the prescription step.'
        : 'Work through the steps — the order summary updates as you go.'

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-background px-5 py-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/sales-orders')}>
            <RiArrowLeftSLine className="size-4 mr-1" />
            Back to Sales Orders
          </Button>
        </div>
      </div>

      <ErrorBoundary>
        <SalesOrderIntakeForm
          draftOrderId={draftOrderId}
          reorderFromId={reorderFromId}
          initialPatient={initialPatient}
        />
      </ErrorBoundary>
    </div>
  )
}

export default SalesOrderAssistant
