import { RiArrowLeftSLine } from '@remixicon/react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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

  const title = draftOrderId
    ? 'Continue Draft Order'
    : reorderFromId
      ? 'Reorder'
      : initialPatient
        ? `New Order — ${initialPatient.name}`
        : 'Sales Order Assistant'

  const subtitle = draftOrderId
    ? 'Pick up where you left off and complete this draft.'
    : reorderFromId
      ? 'Pre-filled from a previous order — review and confirm details.'
      : initialPatient
        ? 'Patient pre-filled — continue from the prescription step.'
        : 'Use the guided assistant to create a new sales order.'

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
