import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { RiAddLine, RiDownloadLine, RiEditLine, RiFileTextLine, RiMore2Line } from '@remixicon/react'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'
import { cn, downloadFile } from '@/utils/helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { VALIDITY_CLASS, eyeSummary, prescriptionTypeLabel, validityOf } from '@/components/prescriptions/rxFormat'

type Dialog = { prescription: Prescription | null; editing: boolean } | null

const Prescriptions = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [dialog, setDialog] = useState<Dialog>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', page, pageSize],
    queryFn: () => prescriptionsApi.getAll({ page, page_size: pageSize }),
  })
  const prescriptions = data?.data || []

  // Links like /prescriptions?detail=PRE000001 open that prescription
  useEffect(() => {
    const detailId = searchParams.get('detail')
    if (!detailId) return
    let active = true
    prescriptionsApi.getById(detailId).then((rx) => {
      if (active) setDialog({ prescription: rx, editing: false })
    }).catch(() => {
      if (!active) return
      toast.error('Could not open that prescription')
      setSearchParams({}, { replace: true })
    })
    return () => { active = false }
  }, [searchParams, setSearchParams])

  const open = (prescription: Prescription | null, editing = false) => setDialog({ prescription, editing })

  const download = async (rx: Prescription) => {
    try {
      downloadFile(await prescriptionsApi.downloadPDF(rx.prescription_id), `prescription-${rx.prescription_id}.pdf`)
    } catch {
      toast.error('Could not download the PDF')
    }
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const columns = useMemo<ColumnDef<Prescription>[]>(
    () => [
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{row.original.patient_name}</span>
            <span className="text-xs text-muted-foreground">{row.original.patient_id}</span>
          </div>
        ),
      },
      {
        accessorKey: 'prescription_date',
        header: 'Exam',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatDate(row.original.prescription_date, 'd MMM yyyy')}</span>
            <span className="text-xs text-muted-foreground">{row.original.doctor_name}</span>
          </div>
        ),
      },
      {
        id: 'rx',
        header: 'Prescription',
        enableSorting: false,
        cell: ({ row }) => {
          const eye = row.original.eye_prescription
          if (!eye) {
            const meds = row.original.medications?.length ?? 0
            return <span className="text-sm text-muted-foreground">{meds ? `${meds} medication${meds > 1 ? 's' : ''}` : 'No glasses Rx'}</span>
          }
          return (
            <div className="flex flex-col text-sm tabular-nums">
              <span><span className="mr-1.5 text-xs font-semibold text-muted-foreground">R</span>{eyeSummary(eye.right_eye)}</span>
              <span><span className="mr-1.5 text-xs font-semibold text-muted-foreground">L</span>{eyeSummary(eye.left_eye)}</span>
              <span className="text-xs text-muted-foreground">{prescriptionTypeLabel(eye.prescription_type)}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'diagnosis',
        header: 'Diagnosis',
        cell: ({ row }) => <span className="line-clamp-2 max-w-64 text-sm text-foreground">{row.original.diagnosis}</span>,
      },
      {
        accessorKey: 'valid_until',
        header: 'Valid until',
        cell: ({ row }) => {
          const validity = validityOf(row.original)
          return (
            <div className="flex flex-col items-start gap-1">
              <span className="text-sm">{formatDate(row.original.valid_until, 'd MMM yyyy')}</span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', VALIDITY_CLASS[validity.tone])}>{validity.label}</span>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.patient_name}`}>
                  <RiMore2Line />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="gap-2" onSelect={() => open(row.original)}>
                  <RiFileTextLine className="size-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => open(row.original, true)}>
                  <RiEditLine className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => download(row.original)}>
                  <RiDownloadLine className="size-4" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Eye test results and what was prescribed. Click a row to see it in full.</p>
        </div>
        <Button className="w-full md:w-auto" onClick={() => open(null)}>
          <RiAddLine />
          New prescription
        </Button>
      </section>

      <Card className="border-border/60">
        <CardContent className="px-0 pb-0 pt-5">
          <DataTable
            columns={columns}
            data={prescriptions}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => { setSearch(value); setPage(1) }}
            loading={isLoading}
            searchPlaceholder="Search by patient, doctor or diagnosis…"
            className="px-6"
            onRowClick={(rx) => open(rx)}
            emptyMessage="No prescriptions yet. Write one from an appointment, or with New prescription."
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
        isOpen={!!dialog}
        onClose={() => {
          setDialog(null)
          if (searchParams.get('detail')) setSearchParams({}, { replace: true })
        }}
        prescription={dialog?.prescription ?? null}
        startEditing={dialog?.editing ?? false}
        onSuccess={() => refetch()}
        onSwitchToEdit={(rx) => open(rx)}
      />
    </div>
  )
}

export default Prescriptions
