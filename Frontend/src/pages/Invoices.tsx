import { Plus, Receipt } from 'lucide-react'

const Invoices = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage invoices and billing</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Invoice
        </button>
      </div>

      <div className="card">
        <p className="text-gray-600">Invoices list coming soon...</p>
      </div>
    </div>
  )
}

export default Invoices
