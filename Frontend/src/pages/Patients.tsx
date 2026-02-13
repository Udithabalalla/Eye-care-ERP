import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { Plus, SearchLg, Edit01, Trash01 } from '@untitledui/icons'
import {
  Table,
  TableCard,
  PaginationPageDefault,
  Button,
  Input,
  BadgeWithDot,
  Avatar,
  Select,
  SelectItem,
  Tooltip
} from '@/components/ui'
import Loading from '@/components/common/Loading'
import PatientModal from '@/components/patients/PatientModal'
import { formatDate, formatPhone } from '@/utils/formatters'
import { Patient } from '@/types/patient.types'
import { Key } from 'react-aria-components'

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

  const handlePageSizeChange = (key: Key | null) => {
    if (key) {
      setPageSize(Number(key))
      setPage(1) // Reset to first page when changing page size
    }
  }

  return (
    <div className="space-y-6">
      {/* Table Card with Untitled UI Structure */}
      <TableCard.Root>
        <TableCard.Header
          title="Patients"
          badge={data?.total || 0}
          description="Manage patient records and information"
          contentTrailing={
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Search patients..."
                  value={search}
                  onChange={setSearch}
                  iconLeading={SearchLg}
                  aria-label="Search patients"
                />
              </div>
              <Select
                selectedKey={String(pageSize)}
                onSelectionChange={handlePageSizeChange}
                placeholder="Rows"
                aria-label="Rows per page"
                className="w-full sm:w-32"
              >
                <SelectItem id="10">10 rows</SelectItem>
                <SelectItem id="25">25 rows</SelectItem>
                <SelectItem id="50">50 rows</SelectItem>
                <SelectItem id="100">100 rows</SelectItem>
              </Select>
              <Button onClick={handleAdd} iconLeading={Plus} size="sm">
                Add Patient
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
            <Table aria-label="Patients table" selectionMode="multiple" selectionBehavior="toggle">
              <Table.Header>
                <Table.Head label="Name" isRowHeader />
                <Table.Head label="Phone" />
                <Table.Head label="Age/Gender" />
                <Table.Head label="Last Visit" />
                <Table.Head label="Visits" />
                <Table.Head label="Status" />
                <Table.Head />
              </Table.Header>
              <Table.Body items={data?.data || []}>
                {(patient) => (
                  <Table.Row id={patient.patient_id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Avatar src={`https://ui-avatars.com/api/?name=${patient.name}&background=random`} alt={patient.name} size="md" />
                        <div>
                          <p className="font-medium text-primary">{patient.name}</p>
                          <p className="text-sm text-tertiary">{patient.email}</p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatPhone(patient.phone)}</Table.Cell>
                    <Table.Cell>
                      <span className="capitalize">{patient.age} / {patient.gender}</span>
                    </Table.Cell>
                    <Table.Cell>
                      {patient.last_visit ? formatDate(patient.last_visit) : 'Never'}
                    </Table.Cell>
                    <Table.Cell>{patient.total_visits}</Table.Cell>
                    <Table.Cell>
                      <BadgeWithDot size="md" color={patient.is_active ? 'success' : 'error'}>
                        {patient.is_active ? 'Active' : 'Inactive'}
                      </BadgeWithDot>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title="Edit patient">
                          <Button
                            color="link-gray"
                            onClick={() => handleEdit(patient)}
                            iconLeading={Edit01}
                            aria-label="Edit"
                            size="sm"
                          />
                        </Tooltip>
                        <Tooltip title="Delete patient">
                          <Button
                            color="link-destructive"
                            onClick={() => {/* Implement delete */ }}
                            iconLeading={Trash01}
                            aria-label="Delete"
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
