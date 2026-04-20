import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { Plus, SearchLg, Eye } from '@untitledui/icons'
import {
  PaginationPageDefault,
  Avatar,
} from '@/components/ui'
import Loading from '@/components/common/Loading'
import PatientModal from '@/components/patients/PatientModal'
import PatientDetailsDialog from '@/components/patients/PatientDetailsDialog'
import { formatDate, formatPhone } from '@/utils/formatters'
import { Patient } from '@/types/patient.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

const Patients = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedDetailsPatient, setSelectedDetailsPatient] = useState<Patient | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', page, pageSize, search],
    queryFn: () => patientsApi.getAll({ page, page_size: pageSize, search }),
  })

  const patients = data?.data || []
  const isAllSelected = patients.length > 0 && patients.every((patient) => selectedPatientIds.includes(patient.patient_id))
  const isIndeterminate = selectedPatientIds.some((patientId) => patients.some((patient) => patient.patient_id === patientId)) && !isAllSelected

  const handleAdd = () => {
    setSelectedPatient(null)
    setIsModalOpen(true)
  }

  const handleShowDetails = (patient: Patient) => {
    setSelectedPatientId(patient.patient_id)
    setSelectedDetailsPatient(patient)
    setIsDetailsOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedPatient(null)
  }

  const handleDetailsClose = () => {
    setIsDetailsOpen(false)
    setSelectedPatientId(null)
    setSelectedDetailsPatient(null)
  }

  const handlePageSizeChange = (value: string) => {
    if (value) {
      setPageSize(Number(value))
      setPage(1) // Reset to first page when changing page size
    }
  }

  const toggleAllVisiblePatients = (isSelected: boolean) => {
    const visibleIds = patients.map((patient) => patient.patient_id)

    if (isSelected) {
      setSelectedPatientIds((current) => Array.from(new Set([...current, ...visibleIds])))
      return
    }

    setSelectedPatientIds((current) => current.filter((patientId) => !visibleIds.includes(patientId)))
  }

  const togglePatientSelection = (patientId: string, isSelected: boolean) => {
    setSelectedPatientIds((current) =>
      isSelected ? [...current, patientId] : current.filter((value) => value !== patientId),
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">Manage patient records and information.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="w-full md:w-auto">
          <Plus className="size-4" />
          Add Patient
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Patient Directory</CardTitle>
              <CardDescription>Search, filter, and review patient records.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>

          <FieldGroup className="w-full md:w-auto md:self-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
              <Field className="w-full sm:w-64">
                <FieldLabel htmlFor="patients-search">Search</FieldLabel>
                <div className="relative">
                  <SearchLg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="patients-search"
                    placeholder="Search patients..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    aria-label="Search patients"
                  />
                </div>
              </Field>
              <Field className="w-full sm:w-32">
                <FieldLabel>Rows</FieldLabel>
                <Select
                  value={String(pageSize)}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger aria-label="Rows per page" className="w-full">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="25">25 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <>
              <Table aria-label="Patients table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="Select all patients"
                        checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                        onCheckedChange={(checked) => toggleAllVisiblePatients(checked === true)}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Age/Gender</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.patient_id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${patient.name}`}
                          checked={selectedPatientIds.includes(patient.patient_id)}
                          onCheckedChange={(checked) => togglePatientSelection(patient.patient_id, checked === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar src={`https://ui-avatars.com/api/?name=${patient.name}&background=random`} alt={patient.name} size="md" />
                          <div>
                            <p className="font-medium text-foreground">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">{patient.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatPhone(patient.phone)}</TableCell>
                      <TableCell>
                        <span className="capitalize">{patient.age} / {patient.gender}</span>
                      </TableCell>
                      <TableCell>
                        {patient.last_visit ? formatDate(patient.last_visit) : 'Never'}
                      </TableCell>
                      <TableCell>{patient.total_visits}</TableCell>
                      <TableCell>
                        <Badge variant={patient.is_active ? 'secondary' : 'destructive'}>
                          {patient.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowDetails(patient)}
                                aria-label="Details"
                              >
                                <Eye className="size-4" />
                                Details
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View patient details</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && (
                <PaginationPageDefault
                  page={page}
                  total={data.total_pages}
                  onPageChange={setPage}
                  className="border-t border-border px-6 py-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <PatientModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        patient={selectedPatient}
        onSuccess={() => refetch()}
      />

      <PatientDetailsDialog
        isOpen={isDetailsOpen}
        patientId={selectedPatientId}
        initialPatient={selectedDetailsPatient}
        onClose={handleDetailsClose}
      />
    </div>
  )
}

export default Patients





