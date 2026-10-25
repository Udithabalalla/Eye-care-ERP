import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { formatDistanceToNowStrict, parseISO, startOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import {
  RiAddLine,
  RiCalendarLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiEyeLine,
  RiMore2Line,
  RiReceiptLine,
  RiShoppingBag3Line,
  RiTeamLine,
  RiWallet3Line,
} from '@remixicon/react'
import { patientsApi } from '@/api/patients.api'
import { appointmentsApi } from '@/api/appointments.api'
import { invoicesApi } from '@/api/invoices.api'
import { salesOrdersApi } from '@/api/erp.api'
import { Patient } from '@/types/patient.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DataTable, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import PatientModal from '@/components/patients/PatientModal'
import { PatientAvatar } from '@/components/patients/PatientAvatar'
import { PatientDetailSheet, type PatientDrawerActions } from '@/components/patients/PatientDetailSheet'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/utils/formatters'

const today = () => new Date().toISOString().slice(0, 10)

/** Small clickable figure in the strip above the directory */
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'warn' | 'good'
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors enabled:hover:border-primary/40 disabled:cursor-default"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn('block text-lg font-semibold tabular-nums', tone === 'warn' && 'text-amber-600 dark:text-amber-400', tone === 'good' && 'text-emerald-600 dark:text-emerald-400')}>
          {value}
        </span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

const Patients = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [formPatient, setFormPatient] = useState<Patient | null | undefined>(undefined) // undefined = closed, null = new
  const [appointmentFor, setAppointmentFor] = useState<string | undefined>(undefined)
  const [prescriptionFor, setPrescriptionFor] = useState<string | undefined>(undefined)
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null)

  // Deep link from anywhere a patient is mentioned: /patients?detail=PAT000012
  const urlDetail = searchParams.get('detail')
  useEffect(() => {
    if (urlDetail) setDetailId(urlDetail)
  }, [urlDetail])

  const sortBy = sorting[0]?.id
  const sortOrder = sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, pageSize, deferredSearch, sortBy, sortOrder],
    queryFn: () => patientsApi.getAll({ page, page_size: pageSize, search: deferredSearch || undefined, sort_by: sortBy, sort_order: sortOrder }),
    placeholderData: keepPreviousData,
  })
  const patients = useMemo(() => data?.data ?? [], [data])

  // ── The day at a glance ──
  const { data: newestPatients } = useQuery({
    queryKey: ['patients', 'newest'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' }),
    staleTime: 2 * 60 * 1000,
  })
  const monthStart = startOfMonth(new Date())
  const newThisMonth = newestPatients?.data.filter((p) => p.created_at && parseISO(p.created_at) >= monthStart).length

  const { data: todaysAppointments } = useQuery({
    queryKey: ['appointments', 'today', today()],
    queryFn: () => appointmentsApi.getAll({ start_date: today(), end_date: today(), page_size: 50 }),
    staleTime: 60_000,
  })
  const activeToday = (todaysAppointments?.data ?? []).filter((a) => !['cancelled', 'no-show'].includes(a.status))

  const { data: readyOrders } = useQuery({
    queryKey: ['sales-orders', 'ready-to-collect'],
    queryFn: () => salesOrdersApi.getAll({ status: 'ready', page_size: 20 }),
    staleTime: 60_000,
  })

  const { data: owing } = useQuery({
    queryKey: ['invoices', 'owing-summary'],
    queryFn: async () => {
      const [pending, partial, overdue] = await Promise.all([
        invoicesApi.getAll({ payment_status: 'pending', page_size: 100 }),
        invoicesApi.getAll({ payment_status: 'partial', page_size: 100 }),
        invoicesApi.getAll({ payment_status: 'overdue', page_size: 100 }),
      ])
      const rows = [...pending.data, ...partial.data, ...overdue.data]
      return { count: rows.length, total: rows.reduce((sum, inv) => sum + (inv.balance_due ?? 0), 0) }
    },
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (patientId: string) => patientsApi.delete(patientId),
    onSuccess: (_data, patientId) => {
      toast.success('Patient deleted')
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setPatientToDelete(null)
      setSelectedIds((ids) => ids.filter((id) => id !== patientId))
      if (detailId === patientId) setDetailId(null)
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to delete patient'),
  })

  const actions: PatientDrawerActions = {
    onNewOrder: (patient) => navigate('/sales-orders/assistant', { state: { patient } }),
    onBookAppointment: (patient) => setAppointmentFor(patient.patient_id),
    onNewPrescription: (patient) => setPrescriptionFor(patient.patient_id),
    onEdit: (patient) => setFormPatient(patient),
    onDelete: (patient) => setPatientToDelete(patient),
  }

  const selectedRows = useMemo(() => patients.filter((p) => selectedIds.includes(p.patient_id)), [patients, selectedIds])
  const allSelected = patients.length > 0 && patients.every((p) => selectedIds.includes(p.patient_id))
  const someSelected = !allSelected && patients.some((p) => selectedIds.includes(p.patient_id))

  const toggle = (id: string, on: boolean) => setSelectedIds((ids) => (on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)))
  const toggleAll = (on: boolean) => {
    const visible = patients.map((p) => p.patient_id)
    setSelectedIds((ids) => (on ? [...new Set([...ids, ...visible])] : ids.filter((id) => !visible.includes(id))))
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      setPage(1)
      return next
    })
  }

  const rowActions: RowAction<Patient>[] = [
    { id: 'open', label: 'Open', icon: RiEyeLine, onClick: (rows) => setDetailId(rows[0].patient_id), showWhen: 'single', primary: true },
    { id: 'new-order', label: 'New sales order', icon: RiReceiptLine, onClick: (rows) => actions.onNewOrder(rows[0]), showWhen: 'single', primary: true },
    { id: 'book', label: 'Book appointment', icon: RiCalendarLine, onClick: (rows) => actions.onBookAppointment(rows[0]), showWhen: 'single' },
    { id: 'edit', label: 'Edit patient', icon: RiEdit2Line, onClick: (rows) => actions.onEdit(rows[0]), showWhen: 'single' },
    { id: 'delete', label: 'Delete patient', icon: RiDeleteBin6Line, onClick: (rows) => actions.onDelete(rows[0]), showWhen: 'single' },
  ]

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all patients"
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <span onClick={(e) => e.stopPropagation()}>
            <Checkbox
              aria-label={`Select ${row.original.name}`}
              checked={selectedIds.includes(row.original.patient_id)}
              onCheckedChange={(checked) => toggle(row.original.patient_id, checked === true)}
            />
          </span>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: 'Patient',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <PatientAvatar name={row.original.name} seed={row.original.patient_id} />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.phone}
                {row.original.address?.city ? ` · ${row.original.address.city}` : ''}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'age_gender',
        header: 'Age',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.age} <span className="capitalize text-muted-foreground">· {row.original.gender}</span>
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'last_visit',
        header: 'Last visit',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.last_visit ? (
            <div className="flex flex-col">
              <span>{formatDate(row.original.last_visit)}</span>
              <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(parseISO(row.original.last_visit), { addSuffix: true })}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      },
      {
        id: 'next_appointment',
        header: 'Next appointment',
        cell: ({ row }) =>
          row.original.next_appointment ? (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              {formatDate(row.original.next_appointment, 'EEE dd MMM')}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        enableSorting: false,
      },
      {
        accessorKey: 'total_visits',
        header: 'Visits',
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.total_visits ?? 0}</span>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                actions.onNewOrder(row.original)
              }}
            >
              <RiReceiptLine className="size-3" />
              New order
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="data-[state=open]:bg-muted" aria-label="More actions" onClick={(e) => e.stopPropagation()}>
                  <RiMore2Line className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setDetailId(row.original.patient_id)}>
                  <RiEyeLine className="size-4" />
                  Open patient
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onBookAppointment(row.original)}>
                  <RiCalendarLine className="size-4" />
                  Book appointment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onEdit(row.original)}>
                  <RiEdit2Line className="size-4" />
                  Edit patient
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDelete(row.original)}>
                  <RiDeleteBin6Line className="size-4" />
                  Delete patient
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSelected, someSelected, selectedIds],
  )

  const ready = readyOrders?.data ?? []

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">Find a patient to see their eyes, orders and visits — and start their next order.</p>
        </div>
        <Button onClick={() => setFormPatient(null)} size="sm" className="w-full md:w-auto">
          <RiAddLine className="size-4" />
          Add patient
        </Button>
      </section>

      {/* ── Today ── */}
      {/* Tiles fit the space left beside a pinned drawer, not just the window */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
        <StatTile
          icon={RiTeamLine}
          label="Patients"
          value={data?.total ?? '…'}
          hint={newThisMonth !== undefined ? `${newThisMonth} new this month` : undefined}
        />
        <StatTile
          icon={RiCalendarLine}
          label="Appointments today"
          value={todaysAppointments ? activeToday.length : '…'}
          hint={activeToday.length ? activeToday.slice(0, 2).map((a) => a.patient_name).join(', ') + (activeToday.length > 2 ? '…' : '') : 'Nothing booked'}
          onClick={() => navigate('/appointments')}
        />
        <StatTile
          icon={RiShoppingBag3Line}
          label="Ready to collect"
          value={readyOrders ? readyOrders.total : '…'}
          tone={ready.length ? 'good' : undefined}
          hint={ready.length ? 'Waiting for their glasses' : 'Nothing waiting'}
          onClick={ready.length ? () => navigate('/sales-orders?status=ready') : undefined}
        />
        <StatTile
          icon={RiWallet3Line}
          label="To collect"
          value={owing ? formatCurrency(owing.total) : '…'}
          tone={owing?.total ? 'warn' : undefined}
          hint={owing ? `${owing.count} unpaid invoice${owing.count === 1 ? '' : 's'}` : undefined}
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* Patients with glasses waiting — straight to them */}
      {ready.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ready to collect:</span>
          {ready.slice(0, 8).map((order) => (
            <button
              key={order.order_id}
              type="button"
              onClick={() => setDetailId(order.patient_id)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              {order.patient_name ?? order.order_number}
            </button>
          ))}
        </div>
      )}

      <PatientDetailSheet
        patientId={detailId}
        open={!!detailId}
        onOpenChange={(open) => {
          if (open) return
          setDetailId(null)
          if (searchParams.get('detail')) {
            setSearchParams((prev) => { prev.delete('detail'); return prev }, { replace: true })
          }
        }}
        actions={actions}
      />

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Patient directory</CardTitle>
              <CardDescription>Click a patient for their prescription, orders, balance and appointments.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{data?.total ?? 0} total</Badge>
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
            searchPlaceholder="Search by name, phone or email…"
            className="px-6"
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={(patient) => setDetailId(patient.patient_id)}
            isRowActive={(patient) => patient.patient_id === detailId}
            onClearSelection={() => setSelectedIds([])}
            emptyMessage={search ? 'No patient matches that search.' : 'No patients yet.'}
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
        isOpen={formPatient !== undefined}
        onClose={() => setFormPatient(undefined)}
        patient={formPatient}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patients'] })
          queryClient.invalidateQueries({ queryKey: ['patient'] })
        }}
      />

      <AppointmentModal
        isOpen={!!appointmentFor}
        onClose={() => setAppointmentFor(undefined)}
        initialPatientId={appointmentFor}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['appointments'] })
          queryClient.invalidateQueries({ queryKey: ['patients'] })
        }}
      />

      <PrescriptionModal
        isOpen={!!prescriptionFor}
        onClose={() => setPrescriptionFor(undefined)}
        initialPatientId={prescriptionFor}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prescriptions'] })}
      />

      <AlertDialog open={!!patientToDelete} onOpenChange={(open) => { if (!open) setPatientToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {patientToDelete?.name || 'this patient'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their record is removed for good, and their prescriptions, orders and invoices lose the link to them. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => patientToDelete && deleteMutation.mutate(patientToDelete.patient_id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete patient'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Patients
