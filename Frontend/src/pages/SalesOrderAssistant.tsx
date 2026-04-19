import { ArrowLeft } from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'

const SalesOrderAssistant = () => {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-secondary bg-primary px-5 py-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-primary">Sales Order Assistant</h1>
            <p className="text-sm text-tertiary">Use the guided assistant to create a new sales order.</p>
          </div>
          <Button size="sm" color="secondary" iconLeading={ArrowLeft} onClick={() => navigate('/sales-orders')}>
            Back to Sales Orders
          </Button>
        </div>
      </div>

      <SalesOrderIntakeForm />
    </div>
  )
}

export default SalesOrderAssistant
