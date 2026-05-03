'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { patientsApi } from '@/api/patients.api'
import {
  RiAddLine,
  RiCalendarLine,
  RiEyeLine,
  RiFileTextLine,
  RiMore2Line,
  RiReceiptLine,
} from '@remixicon/react'
import Pagination from '@/components/common/Pagination'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import PatientModal from '@/components/patients/PatientModal'
import PatientDetailsDialog from '@/components/patients/PatientDetailsDialog'
import { formatDate, formatPhone } from '@/utils/formatters'
import { Patient } from '@/types/patient.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type RowAction } from '@/components/data-table'
import { invoicesApi } from '@/api/invoices.api'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Invoice } from '@/types/invoice.types'
import { Prescription } from '@/types/prescription.types'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import Modal from '@/components/common/Modal'
import InvoiceDetail from '@/components/invoices/InvoiceDetail'
import PaymentModal from '@/components/invoices/PaymentModal'
import { downloadFile } from '@/utils/helpers'
import toast from 'react-hot-toast'

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
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [appointmentPatientId, setAppointmentPatientId] = useState<string | undefined>(undefined)
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  const sortBy = sorting[0]?.id
  const sortOrder = sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', page, pageSize, search, sortBy, sortOrder],
    queryFn: () =>
      patientsApi.getAll({ page, page_size: pageSize, search, sort_by: sortBy, sort_order: sortOrder }),
  })

  const patients = data?.data || []
  const isAllSelected =
    patients.length > 0 && patients.every((patient) => selectedPatientIds.includes(patient.patient_id))
  const isIndeterminate =
    selectedPatientIds.some((patientId) =>
      patients.some((patient) => patient.patient_id === patientId),
    ) && !isAllSelected

  const selectedRows = useMemo(
    () => patients.filter((p) => selectedPatientIds.includes(p.patient_id)),
    [patients, selectedPatientIds],
  )

  const handleAdd = () => {
    setSelectedPatient(null)
    setIsModalOpen(true)
  }

  const handleShowDetails = (patient: Patient) => {
    setSelectedPatientId(patient.patient_id)
    setSelectedDetailsPatient(patient)
    setIsDetailsOpen(true)
  }

  const getLatestByDate = <T,>(items: T[], getDate: (item: T) => string | undefined): T | null => {
    if (!items.length) return null
    return [...items].sort((left, right) => {
      const leftValue = new Date(getDate(left) || '').getTime()
      const rightValue = new Date(getDate(right) || '').getTime()
      return rightValue - leftValue
    })[0]
  }

  const handleOpenAppointment = (patient: Patient) => {
    setAppointmentPatientId(patient.patient_id)
    setIsAppointmentModalOpen(true)
  }

  const handleViewLatestPrescription = async (patient: Patient) => {
    try {
      const response = await prescriptionsApi.getByPatientId(patient.patient_id, { page_size: 100 })
      const latestPrescription = getLatestByDate(response.data, (item) => item.prescription_date)
      if (!latestPrescription) {
        toast.error('No prescriptions found for this patient')
        return
      }
      setSelectedPrescription(latestPrescription)
      setIsPrescriptionModalOpen(true)
    } catch {
      toast.error('Failed to load latest prescription')
    }
  }

  const handleViewLatestInvoice = async (patient: Patient) => {
    try {
      const response = await invoicesApi.getByPatientId(patient.patient_id, { page_size: 100 })
      const latestInvoice = getLatestByDate(response.data, (item) => item.invoice_date)
      if (!latestInvoice) {
        toast.error('No invoices found for this patient')
        return
      }
      setSelectedInvoice(latestInvoice)
      setIsInvoiceDetailOpen(true)
    } catch {
      toast.error('Failed to load latest invoice')
    }
  }

  const handleDownloadInvoicePDF = async (invoiceId: string) => {
    try {
      const blob = await invoicesApi.downloadPDF(invoiceId)
      downloadFile(blob, `invoice-${invoiceId}.pdf`)
      toast.success('Invoice PDF downloaded')
    } catch {
      toast.error('Failed to download invoice PDF')
    }
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
      setPage(1)
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

  const handleRowClick = (patient: Patient) => {
    togglePatientSelection(
      patient.patient_id,
      !selectedPatientIds.includes(patient.patient_id),
    )
  }

  const handleClearSelection = () => setSelectedPatientIds([])

  const handleSortingChange = (updaterOrValue: Updater<SortingState>) => {
    setSorting((current) => {
      const nextSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      setPage(1)
      return nextSorting
    })
  }

  // Actions shown in the contextual button group when one or more rows are selected.
  // primary: true → shows as a top-level button; all actions appear in the ⋯ dropdown.
  const rowActions: RowAction<Patient>[] = [
    {
      id: 'view-history',
      label: 'Customer History',
      icon: RiFileTextLine,
      onClick: (rows) => handleShowDetails(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'new-appointment',
      label: 'New Appointment',
      icon: RiCalendarLine,
      onClick: (rows) => handleOpenAppointment(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'view-prescription',
      label: 'View Latest Prescription',
      icon: RiEyeLine,
      onClick: (rows) => handleViewLatestPrescription(rows[0]),
      showWhen: 'single',
    },
    {
      id: 'view-invoice',
      label: 'View Latest Invoice',
      icon: RiReceiptLine,
      onClick: (rows) => handleViewLatestInvoice(rows[0]),
      showWhen: 'single',
    },
  ]

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
            onCheckedChange={(checked) =>
              togglePatientSelection(row.original.patient_id, checked === true)
            }
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
            Name{' '}
            {column.getIsSorted() === 'asc'
              ? '↑'
              : column.getIsSorted() === 'desc'
                ? '↓'
                : ''}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="relative z-0 flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(row.original.name)}&background=random`}
                alt={row.original.name}
              />
              <AvatarFallback>{row.original.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
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
            Phone{' '}
            {column.getIsSorted() === 'asc'
              ? '↑'
              : column.getIsSorted() === 'desc'
                ? '↓'
                : ''}
          </Button>
        ),
        cell: ({ row }) => formatPhone(row.original.phone),
      },
      {
        id: 'age_gender',
        header: 'Age/Gender',
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.age} / {row.original.gender}
          </span>
        ),
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
            Last Visit{' '}
            {column.getIsSorted() === 'asc'
              ? '↑'
              : column.getIsSorted() === 'desc'
                ? '↓'
                : ''}
          </Button>
        ),
        cell: ({ row }) =>
          row.original.last_visit ? formatDate(row.original.last_visit) : 'Never',
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
            Visits{' '}
            {column.getIsSorted() === 'asc'
              ? '↑'
              : column.getIsSorted() === 'desc'
                ? '↓'
                : ''}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="data-[state=open]:bg-muted"
                aria-label="Open patient actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleShowDetails(row.original)}>
                <RiFileTextLine className="size-4" />
                Customer History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenAppointment(row.original)}>
                <RiCalendarLine className="size-4" />
                New Appointment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewLatestPrescription(row.original)}>
                <RiEyeLine className="size-4" />
                View Latest Prescription
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewLatestInvoice(row.original)}>
                <RiReceiptLine className="size-4" />
                View Latest Invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAllSelected, isIndeterminate, selectedPatientIds],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">Manage patient records and information.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="w-full md:w-auto">
          <RiAddLine className="size-4" />
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
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
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
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={handleRowClick}
            onClearSelection={handleClearSelection}
          />
          {data && (
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              totalItems={data.total}
            />
          )}
        </CardContent>
      </Card>

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

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false)
          setAppointmentPatientId(undefined)
        }}
        initialPatientId={appointmentPatientId}
        onSuccess={() => refetch()}
      />

      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => {
          setIsPrescriptionModalOpen(false)
          setSelectedPrescription(null)
        }}
        prescription={selectedPrescription}
        onSuccess={() => {}}
        readOnly={true}
      />

      <Modal
        isOpen={isInvoiceDetailOpen}
        onClose={() => {
          setIsInvoiceDetailOpen(false)
          setSelectedInvoice(null)
        }}
        title="Invoice Details"
        size="xl"
      >
        {selectedInvoice && (
          <InvoiceDetail
            invoice={selectedInvoice}
            onPayment={() => setIsPaymentModalOpen(true)}
            onDownloadPDF={() => handleDownloadInvoicePDF(selectedInvoice.invoice_id)}
          />
        )}
      </Modal>

      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          invoice={selectedInvoice}
          onSuccess={() => {
            setIsPaymentModalOpen(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

export default Patients
