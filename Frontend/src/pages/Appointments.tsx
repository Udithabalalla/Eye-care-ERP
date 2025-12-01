import { useState } from 'react'
import { Plus, Calendar as CalendarIcon } from 'lucide-react'

const Appointments = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage and schedule appointments</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New Appointment
        </button>
      </div>

      <div className="card">
        <p className="text-gray-600">Appointments list coming soon...</p>
      </div>
    </div>
  )
}

export default Appointments
