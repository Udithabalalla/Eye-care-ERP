import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { patientsApi } from '@/api/patients.api'
import { Plus, Eye } from '@untitledui/icons'
import {
  PaginationPageDefault,
  Avatar,
} from '@/components/ui'
import PatientModal from '@/components/patients/PatientModal'
import PatientDetailsDialog from '@/components/patients/PatientDetailsDialog'
import { formatDate, formatPhone } from '@/utils/formatters'
import { Patient } from '@/types/patient.types'
import { Button } from '@/components/ui/button'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable } from '@/components/data-table'

const Patients = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedDetailsPatient, setSelectedDetailsPatient] = useState<Patient | null>(null)

  const sortBy = sorting[0]?.id
  const sortOrder = sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', page, pageSize, search, sortBy, sortOrder],
    queryFn: () => patientsApi.getAll({ page, page_size: pageSize, search, sort_by: sortBy, sort_order: sortOrder }),
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

  const handleSortingChange = (updaterOrValue: Updater<SortingState>) => {
    setSorting((current) => {
      const nextSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      setPage(1)
      return nextSorting
    })
  }

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all patients"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAllVisiblePatients(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.name}`}
            checked={selectedPatientIds.includes(row.original.patient_id)}
            onCheckedChange={(checked) => togglePatientSelection(row.original.patient_id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar src={`https://ui-avatars.com/api/?name=${row.original.name}&background=random`} alt={row.original.name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.name}</p>
              <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Phone {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </Button>
        ),
        cell: ({ row }) => formatPhone(row.original.phone),
      },
      {
        id: 'age_gender',
        header: 'Age/Gender',
        cell: ({ row }) => <span className="capitalize">{row.original.age} / {row.original.gender}</span>,
        enableSorting: false,
      },
      {
        accessorKey: 'last_visit',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Last Visit {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </Button>
        ),
        cell: ({ row }) => (row.original.last_visit ? formatDate(row.original.last_visit) : 'Never'),
      },
      {
        accessorKey: 'total_visits',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Visits {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </Button>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'secondary' : 'destructive'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShowDetails(row.original)}
                  aria-label="Details"
                >
                  <Eye className="size-4" />
                  Details
                </Button>
              </TooltipTrigger>
              <TooltipContent>View patient details</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
    ],
    [handleShowDetails, isAllSelected, isIndeterminate, selectedPatientIds],
  )

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

          <div className="w-full md:w-auto md:self-end">
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger aria-label="Rows per page" className="w-full sm:w-32">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={patients}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            loading={isLoading}
            searchPlaceholder="Search patients..."
            className="px-6"
          />
          {data && (
            <PaginationPageDefault
              page={page}
              total={data.total_pages}
              onPageChange={setPage}
              className="border-t border-border px-6 py-4"
            />
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





