import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Plus, SearchLg, File06, Calendar, Eye, Download01 } from '@untitledui/icons'
import { Table, TableCard, PaginationPageDefault, Button, Input, BadgeWithDot, Select, SelectItem, Tooltip } from '@/components/ui'
import Loading from '@/components/common/Loading'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'
import { Key } from 'react-aria-components'

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

  const handlePageSizeChange = (key: Key | null) => {
    if (key) {
      setPageSize(Number(key))
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Total Prescriptions</p>
              <p className="text-2xl font-bold text-primary">{data?.total || 0}</p>
            </div>
            <File06 className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Eye Prescriptions</p>
              <p className="text-2xl font-bold text-brand-600">
                {data?.data.filter((p) => p.eye_prescription).length || 0}
              </p>
            </div>
            <Eye className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">With Medications</p>
              <p className="text-2xl font-bold text-success-600">
                {data?.data.filter((p) => p.medications && p.medications.length > 0).length || 0}
              </p>
            </div>
            <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center text-success-600 text-lg">💊</div>
          </div>
        </div>
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Expired</p>
              <p className="text-2xl font-bold text-error-600">
                {data?.data.filter((p) => new Date(p.valid_until) < new Date()).length || 0}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-error-600" />
          </div>
        </div>
      </div>

      {/* Table Card with Untitled UI Structure */}
      <TableCard.Root>
        <TableCard.Header
          title="Prescriptions"
          badge={data?.total || 0}
          description="Manage patient prescriptions"
          contentTrailing={
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input
                placeholder="Search prescriptions..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                aria-label="Search prescriptions"
                className="w-full sm:w-48"
              />
              <Input
                placeholder="Filter by Patient ID"
                value={patientFilter}
                onChange={setPatientFilter}
                aria-label="Filter by patient"
                className="w-full sm:w-36"
              />
              <Input
                placeholder="Filter by Doctor ID"
                value={doctorFilter}
                onChange={setDoctorFilter}
                aria-label="Filter by doctor"
                className="w-full sm:w-36"
              />
              <Select
                selectedKey={String(pageSize)}
                onSelectionChange={handlePageSizeChange}
                placeholder="Rows"
                aria-label="Rows per page"
                className="w-full sm:w-28"
              >
                <SelectItem id="10">10 rows</SelectItem>
                <SelectItem id="25">25 rows</SelectItem>
                <SelectItem id="50">50 rows</SelectItem>
              </Select>
              <Button onClick={handleAdd} iconLeading={Plus} size="sm">
                New Prescription
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table aria-label="Prescriptions table" selectionMode="multiple" selectionBehavior="toggle">
              <Table.Header>
                <Table.Head label="Prescription ID" isRowHeader />
                <Table.Head label="Patient" />
                <Table.Head label="Doctor" />
                <Table.Head label="Diagnosis" />
                <Table.Head label="Type" />
                <Table.Head label="Valid Until" />
                <Table.Head />
              </Table.Header>
              <Table.Body items={filteredData || []}>
                {(prescription) => (
                  <Table.Row id={prescription.prescription_id}>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-primary">{prescription.prescription_id}</p>
                        <p className="text-sm text-tertiary">{formatDate(prescription.prescription_date)}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-primary">{prescription.patient_name}</p>
                        <p className="text-sm text-tertiary">{prescription.patient_id}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-primary">{prescription.doctor_name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-primary">{prescription.diagnosis}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {prescription.eye_prescription && (
                          <BadgeWithDot size="sm" color="brand">
                            {prescription.eye_prescription.prescription_type}
                          </BadgeWithDot>
                        )}
                        {prescription.medications && prescription.medications.length > 0 && (
                          <BadgeWithDot size="sm" color="success">
                            {prescription.medications.length} Med{prescription.medications.length > 1 ? 's' : ''}
                          </BadgeWithDot>
                        )}
                        {prescription.contact_lenses && (
                          <BadgeWithDot size="sm" color="warning">
                            Contact Lenses
                          </BadgeWithDot>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {(() => {
                        const validDate = new Date(prescription.valid_until)
                        const isExpired = validDate < new Date()
                        return (
                          <span className={isExpired ? 'text-error-600 font-medium' : 'text-primary'}>
                            {formatDate(prescription.valid_until)}
                          </span>
                        )
                      })()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title="View prescription">
                          <Button
                            color="link-gray"
                            onClick={() => handleEdit(prescription)}
                            iconLeading={Eye}
                            aria-label="View"
                            size="sm"
                          />
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <Button
                            color="link-gray"
                            onClick={() => handleDownloadPDF(prescription.prescription_id)}
                            iconLeading={Download01}
                            aria-label="Download PDF"
                            size="sm"
                          />
                        </Tooltip>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
            {data && (
              <PaginationPageDefault
                page={page}
                total={data.total_pages}
                onPageChange={setPage}
                className="border-t border-secondary px-6 py-4"
              />
            )}
          </>
        )}
      </TableCard.Root>

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
