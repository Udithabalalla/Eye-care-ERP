import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Plus, Search, FileText, Calendar, Eye } from 'lucide-react'
import Table from '@/components/common/Table'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'

const Prescriptions = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', page, pageSize, patientFilter, doctorFilter],
    queryFn: () =>
      prescriptionsApi.getAll({
        page,
        page_size: pageSize,
        patient_id: patientFilter || undefined,
        doctor_id: doctorFilter || undefined,
      }),
  })

  const handleEdit = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedPrescription(null)
    setIsModalOpen(true)
  }

  const handleDownloadPDF = async (prescriptionId: string) => {
    try {
      const blob = await prescriptionsApi.downloadPDF(prescriptionId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prescription-${prescriptionId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  // Filter data based on search
  const filteredData = data?.data.filter((prescription) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      prescription.prescription_id.toLowerCase().includes(searchLower) ||
      prescription.patient_name.toLowerCase().includes(searchLower) ||
      prescription.doctor_name.toLowerCase().includes(searchLower) ||
      prescription.diagnosis.toLowerCase().includes(searchLower)
    )
  })

  const columns = [
    {
      key: 'prescription_id',
      header: 'Prescription ID',
      render: (prescription: Prescription) => (
        <div>
          <p className="font-medium text-text-primary">{prescription.prescription_id}</p>
          <p className="text-sm text-text-tertiary">{formatDate(prescription.prescription_date)}</p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (prescription: Prescription) => (
        <div>
          <p className="font-medium text-text-primary">{prescription.patient_name}</p>
          <p className="text-sm text-text-tertiary">{prescription.patient_id}</p>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (prescription: Prescription) => (
        <div>
          <p className="text-text-primary">{prescription.doctor_name}</p>
        </div>
      ),
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (prescription: Prescription) => (
        <span className="text-text-primary">{prescription.diagnosis}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (prescription: Prescription) => (
        <div className="flex flex-wrap gap-1">
          {prescription.eye_prescription && (
            <span className="badge-info text-xs">
              <Eye className="w-3 h-3 inline mr-1" />
              {prescription.eye_prescription.prescription_type}
            </span>
          )}
          {prescription.medications && prescription.medications.length > 0 && (
            <span className="badge-success text-xs">
              {prescription.medications.length} Med{prescription.medications.length > 1 ? 's' : ''}
            </span>
          )}
          {prescription.contact_lenses && (
            <span className="badge-warning text-xs">Contact Lenses</span>
          )}
        </div>
      ),
    },
    {
      key: 'valid_until',
      header: 'Valid Until',
      render: (prescription: Prescription) => {
        const validDate = new Date(prescription.valid_until)
        const isExpired = validDate < new Date()
        return (
          <span className={isExpired ? 'text-red-600 font-medium' : 'text-text-primary'}>
            {formatDate(prescription.valid_until)}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (prescription: Prescription) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDownloadPDF(prescription.prescription_id)
          }}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center"
          title="Download PDF"
        >
          <FileText className="w-4 h-4 mr-1" />
          PDF
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Prescriptions</h1>
          <p className="text-text-secondary mt-1">Manage patient prescriptions</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New Prescription
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search prescriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Filter by Patient ID"
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Filter by Doctor ID"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Total Prescriptions</p>
              <p className="text-2xl font-bold text-text-primary">{data?.total || 0}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Eye Prescriptions</p>
              <p className="text-2xl font-bold text-purple-600">
                {data?.data.filter((p) => p.eye_prescription).length || 0}
              </p>
            </div>
            <Eye className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">With Medications</p>
              <p className="text-2xl font-bold text-green-600">
                {data?.data.filter((p) => p.medications && p.medications.length > 0).length || 0}
              </p>
            </div>
            <div className="text-3xl">💊</div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Expired</p>
              <p className="text-2xl font-bold text-red-600">
                {data?.data.filter((p) => new Date(p.valid_until) < new Date()).length || 0}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-red-600" />
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
            <Table data={filteredData || []} columns={columns} onRowClick={handleEdit} />
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

      {/* Prescription Modal */}
      <PrescriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPrescription(null)
        }}
        prescription={selectedPrescription}
        onSuccess={() => refetch()}
        onSwitchToEdit={handleEdit}
      />
    </div>
  )
}

export default Prescriptions
