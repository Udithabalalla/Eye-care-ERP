import { RiArrowLeftSLine } from '@remixicon/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PurchaseOrderWizard from '@/components/purchase-orders/PurchaseOrderWizard'

/** /purchase-orders/new — also ?draft=PO… to edit a draft, ?copy=PO… to order again, ?supplier=SUP… to preselect */
const PurchaseOrderCreate = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft') || undefined
  const copyFromId = searchParams.get('copy') || undefined
  const supplierId = searchParams.get('supplier') || undefined

  const title = draftId ? `Edit draft ${draftId}` : copyFromId ? 'Order again' : 'New purchase order'
  const subtitle = draftId
    ? 'Change anything on the draft, then save or approve it.'
    : copyFromId
      ? `Pre-filled from ${copyFromId} — check quantities and prices.`
      : 'Four short steps — the purchase order preview updates as you go.'

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-background px-5 py-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/purchase-orders')}>
            <RiArrowLeftSLine className="mr-1 size-4" />
            Back to Purchase Orders
          </Button>
        </div>
      </div>

      <ErrorBoundary>
        {/* Keyed so switching between drafts starts the form afresh */}
        <PurchaseOrderWizard key={draftId ?? copyFromId ?? 'new'} draftId={draftId} copyFromId={copyFromId} initialSupplierId={supplierId} />
      </ErrorBoundary>
    </div>
  )
}

export default PurchaseOrderCreate
