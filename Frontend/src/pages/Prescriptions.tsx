import { Plus, FileText } from 'lucide-react'

const Prescriptions = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
          <p className="text-gray-600 mt-1">Manage patient prescriptions</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New Prescription
        </button>
      </div>

      <div className="card">
        <p className="text-gray-600">Prescriptions list coming soon...</p>
      </div>
    </div>
  )
}

export default Prescriptions
