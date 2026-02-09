import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { Plus, Search } from 'lucide-react'
import Table from '@/components/common/Table'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import PatientModal from '@/components/patients/PatientModal'
import { formatDate, formatPhone } from '@/utils/formatters'
import { Patient } from '@/types/patient.types'

const Patients = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', page, pageSize, search],
    queryFn: () => patientsApi.getAll({ page, page_size: pageSize, search }),
  })

  const handleEdit = (patient: Patient) => {
    setSelectedPatient(patient)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedPatient(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedPatient(null)
  }

  const columns = [
    {
      key: 'patient_id',
      header: 'Patient ID',
      render: (patient: Patient) => (
        <span className="font-medium text-primary-600">{patient.patient_id}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (patient: Patient) => (
        <div>
          <p className="font-medium text-text-primary">{patient.name}</p>
          <p className="text-sm text-text-tertiary">{patient.email}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (patient: Patient) => formatPhone(patient.phone),
    },
    {
      key: 'age',
      header: 'Age/Gender',
      render: (patient: Patient) => (
        <span className="capitalize">{patient.age} / {patient.gender}</span>
      ),
    },
    {
      key: 'last_visit',
      header: 'Last Visit',
      render: (patient: Patient) =>
        patient.last_visit ? formatDate(patient.last_visit) : 'Never',
    },
    {
      key: 'total_visits',
      header: 'Visits',
      render: (patient: Patient) => patient.total_visits,
    },
    {
      key: 'status',
      header: 'Status',
      render: (patient: Patient) => (
        <span className={patient.is_active ? 'badge-success' : 'badge-danger'}>
          {patient.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Patients</h1>
          <p className="text-text-secondary mt-1">Manage patient records and information</p>
        </div>
        <button onClick={handleAdd} className="btn-primary font-bold text-white">
          <Plus className="w-5 h-5 mr-2" />
          Add Patient
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 bg-white dark:bg-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table
              data={data?.data || []}
              columns={columns}
              onRowClick={handleEdit}
            />
            {data && (
              <Pagination
                currentPage={page}
                totalPages={data.total_pages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={data.total}
              />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <PatientModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        patient={selectedPatient}
        onSuccess={() => refetch()}
      />
    </div>
  )
}

export default Patients
