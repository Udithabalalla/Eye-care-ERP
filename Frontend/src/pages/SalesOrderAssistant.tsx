import { RiArrowLeftSLine } from '@remixicon/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'
import ErrorBoundary from '@/components/common/ErrorBoundary'

const SalesOrderAssistant = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftOrderId = searchParams.get('draft') || undefined
  const reorderFromId = searchParams.get('reorder') || undefined

  const title = draftOrderId ? 'Continue Draft Order' : reorderFromId ? 'Reorder' : 'Sales Order Assistant'
  const subtitle = draftOrderId
    ? 'Pick up where you left off and complete this draft.'
    : reorderFromId
      ? 'Pre-filled from a previous order — review and confirm details.'
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
        <SalesOrderIntakeForm draftOrderId={draftOrderId} reorderFromId={reorderFromId} />
      </ErrorBoundary>
    </div>
  )
}

export default SalesOrderAssistant
