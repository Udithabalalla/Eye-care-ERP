import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { prescriptionsApi } from '@/api/prescriptions.api'
import {
  RiAddLine,
  RiCalendarLine,
  RiDownloadLine,
  RiEyeLine,
  RiFileTextLine,
  RiMore2Line,
} from '@remixicon/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import Pagination from '@/components/common/Pagination'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

const Prescriptions = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', page, pageSize],
    queryFn: () => prescriptionsApi.getAll({ page, page_size: pageSize }),
  })

  const prescriptions = data?.data || []

  const isAllSelected =
    prescriptions.length > 0 && prescriptions.every((p) => selectedIds.includes(p.prescription_id))
  const isIndeterminate =
    selectedIds.some((id) => prescriptions.some((p) => p.prescription_id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => prescriptions.filter((p) => selectedIds.includes(p.prescription_id)),
    [prescriptions, selectedIds],
  )

  useEffect(() => {
    const detailId = searchParams.get('detail')
    if (!detailId) return
    let active = true
    prescriptionsApi.getById(detailId).then((rx) => {
      if (!active) return
      setSelectedPrescription(rx)
      setIsModalOpen(true)
    }).catch(() => {
      if (!active) return
      toast.error('Failed to load prescription details')
      setSearchParams({}, { replace: true })
    })
    return () => { active = false }
  }, [searchParams, setSearchParams])

  const handleEdit = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
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
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  const toggleAll = (checked: boolean) => {
    const visibleIds = prescriptions.map((p) => p.prescription_id)
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    }
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)))
  }

  const handleRowClick = (prescription: Prescription) => {
    toggleOne(prescription.prescription_id, !selectedIds.includes(prescription.prescription_id))
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const summaryStats = useMemo(() => ({
    total: data?.total || 0,
    eyePrescriptions: prescriptions.filter((p) => p.eye_prescription).length,
    withMedications: prescriptions.filter((p) => p.medications && p.medications.length > 0).length,
    expired: prescriptions.filter((p) => new Date(p.valid_until) < new Date()).length,
  }), [data, prescriptions])

  const rowActions: RowAction<Prescription>[] = [
    {
      id: 'view',
      label: 'View Details',
      icon: RiFileTextLine,
      onClick: (rows) => handleEdit(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'download-pdf',
      label: 'Download PDF',
      icon: RiDownloadLine,
      onClick: (rows) => handleDownloadPDF(rows[0].prescription_id),
      showWhen: 'single',
    },
  ]

  const columns = useMemo<ColumnDef<Prescription>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all prescriptions"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.prescription_id}`}
            checked={selectedIds.includes(row.original.prescription_id)}
            onCheckedChange={(checked) => toggleOne(row.original.prescription_id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'prescription_id',
        header: 'ID',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-primary text-sm">{row.original.prescription_id}</span>
            <span className="text-xs text-muted-foreground">{formatDate(row.original.prescription_date)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{row.original.patient_name}</span>
            <span className="text-xs text-muted-foreground">{row.original.patient_id}</span>
          </div>
        ),
      },
      {
        accessorKey: 'doctor_name',
        header: 'Doctor',
        cell: ({ row }) => <span className="text-foreground">{row.original.doctor_name}</span>,
      },
      {
        accessorKey: 'diagnosis',
        header: 'Diagnosis',
        cell: ({ row }) => <span className="text-foreground">{row.original.diagnosis}</span>,
      },
      {
        id: 'type',
        header: 'Type',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.eye_prescription && (
              <Badge variant="secondary">
                {row.original.eye_prescription.prescription_type}
              </Badge>
            )}
            {row.original.medications && row.original.medications.length > 0 && (
              <Badge variant="secondary">
                {row.original.medications.length} Med{row.original.medications.length > 1 ? 's' : ''}
              </Badge>
            )}
            {row.original.contact_lenses && (
              <Badge variant="secondary">Contacts</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'valid_until',
        header: 'Valid Until',
        cell: ({ row }) => {
          const isExpired = new Date(row.original.valid_until) < new Date()
          return (
            <span className={isExpired ? 'text-destructive font-medium' : 'text-foreground'}>
              {formatDate(row.original.valid_until)}
            </span>
          )
        },
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
                aria-label="Open prescription actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                <RiFileTextLine className="size-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF(row.original.prescription_id)}>
                <RiDownloadLine className="size-4" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAllSelected, isIndeterminate, selectedIds],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Manage patient prescriptions and records.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedPrescription(null); setIsModalOpen(true) }}
        >
          <RiAddLine className="size-4" />
          New Prescription
        </Button>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.total}</p>
            </div>
            <RiFileTextLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Eye Prescriptions</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.eyePrescriptions}</p>
            </div>
            <RiEyeLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">With Medications</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.withMedications}</p>
            </div>
            <RiFileTextLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.expired}</p>
            </div>
            <RiCalendarLine className="size-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Prescription Records</CardTitle>
              <CardDescription>Search and manage all patient prescriptions.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}
            >
              <SelectTrigger className="w-full sm:w-32" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={prescriptions}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => { setSearch(value); setPage(1) }}
            loading={isLoading}
            searchPlaceholder="Search prescriptions..."
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={handleRowClick}
            onClearSelection={() => setSelectedIds([])}
            emptyMessage="No prescriptions found."
          />
          {data && (
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              totalItems={data.total}
            />
          )}
        </CardContent>
      </Card>

      <PrescriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPrescription(null)
          setSearchParams({}, { replace: true })
        }}
        prescription={selectedPrescription}
        onSuccess={() => refetch()}
        onSwitchToEdit={handleEdit}
      />
    </div>
  )
}

export default Prescriptions
