import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type SortingState, type Updater, type VisibilityState } from '@tanstack/react-table'
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiFileEditLine,
  RiReceiptLine,
  RiMore2Line,
  RiEyeLine,
  RiBox3Line,
  RiSettings4Line,
  RiShieldCheckLine,
  RiTruckLine,
  RiLoader4Line,
  RiDownloadLine,
  RiDownload2Line,
  RiBarcodeLine,
  RiArrowRightLine,
  RiCloseCircleLine,
  RiFileExcel2Line,
  RiFileList3Line,
  RiHashtag,
  RiUser3Line,
  RiProgress3Line,
  RiMoneyDollarCircleLine,
  RiCheckboxCircleLine,
  RiScales3Line,
  RiCalendarScheduleLine,
  RiCalendarLine,
  RiShoppingBag3Line,
  RiSearchLine,
  RiCloseLine,
} from '@remixicon/react'
import { downloadFile } from '@/utils/helpers'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrder, SalesOrderListParams, SalesOrderStatus } from '@/types/erp.types'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable, DataTableSelectionBar, DataTableViewMenu, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'
import { formatCurrency, formatDate, localDateString } from '@/utils/formatters'
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
import { getNextAction } from '@/components/sales-orders/salesOrderWorkflow'
import { STATUS_CONFIG } from '@/components/sales-orders/salesOrderStatusConfig'
import { SalesOrderDetailSheet } from '@/components/sales-orders/SalesOrderDetailSheet'
import { FindOrderByReceiptDialog } from '@/components/sales-orders/FindOrderByReceiptDialog'
import { SalesOrderKpiStrip } from '@/components/sales-orders/SalesOrderKpiStrip'
import { OrderFilterMenu, PatientFilter, type PatientChoice } from '@/components/sales-orders/SalesOrderListFilters'
import { createdRange, type CreatedFilter, type InvoiceFilter } from '@/components/sales-orders/salesOrderCreatedRange'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'

type TabId = 'all' | 'overdue' | 'draft' | 'created' | 'lens_ordered' | 'fitting' | 'ready' | 'delivered' | 'cancelled'

// Status tabs, with live counts from the summary. Older statuses are listed under the tab
// whose label they show (the server folds them in the same way).
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'all', label: 'All' },
  // Unfinished orders saved to continue later
  { id: 'draft', label: 'Drafts' },
  { id: 'created', label: 'Order Created' },
  { id: 'lens_ordered', label: 'Lens Ordered' },
  { id: 'fitting', label: 'Sent for Fitting' },
  { id: 'ready', label: 'Ready' },
  // Past the promised delivery date and not ready yet
  { id: 'overdue', label: 'Overdue' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]
const TAB_FOR_STATUS: Partial<Record<string, TabId>> = {
  confirmed: 'created',
  in_production: 'lens_ordered',
  completed: 'delivered',
}
const tabFromUrl = (value: string | null): TabId | null => {
  if (!value) return null
  if (TABS.some((tab) => tab.id === value)) return value as TabId
  return TAB_FOR_STATUS[value] ?? null
}

// Orders that can still be cancelled: confirmed and not yet handed over (drafts are deleted instead)
const CANCELLABLE: SalesOrderStatus[] = ['created', 'confirmed', 'lens_ordered', 'in_production', 'fitting', 'ready']
// Still being made: late once the promised delivery day has passed
const IN_WORKSHOP: SalesOrderStatus[] = ['created', 'confirmed', 'lens_ordered', 'in_production', 'fitting']
const SORTABLE = new Set(['order_number', 'created_at', 'expected_delivery_date', 'total_amount', 'status'])
const COLUMNS_KEY = 'sales-orders.columns'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const orderTotal = (order: SalesOrder) => order.total_amount || order.subtotal || 0
const isLate = (order: SalesOrder) =>
  !!order.expected_delivery_date &&
  IN_WORKSHOP.includes(order.status) &&
  localDateString(new Date(order.expected_delivery_date)) < localDateString()

/** The selected orders as a spreadsheet (CSV opens in Excel) */
const ordersCsv = (orders: SalesOrder[]) => {
  // Each value quoted, quotes inside doubled (written by char code: a literal quote here trips check:tw)
  const quote = String.fromCharCode(34)
  const cell = (value: unknown) => quote + String(value ?? '').split(quote).join(quote + quote) + quote
  const rows = orders.map((o) => [
    o.order_number,
    o.patient_name || o.patient_id,
    STATUS_CONFIG[o.status]?.label ?? o.status,
    o.items.length,
    orderTotal(o).toFixed(2),
    o.paid_amount != null ? o.paid_amount.toFixed(2) : '',
    o.balance_due != null ? o.balance_due.toFixed(2) : '',
    o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '',
    o.created_at ? formatDate(o.created_at) : '',
    o.invoice_id ? 'Yes' : 'No',
  ])
  return [['Order #', 'Patient', 'Status', 'Items', 'Total (LKR)', 'Paid (LKR)', 'Balance (LKR)', 'Delivery', 'Created', 'Invoiced'], ...rows]
    .map((row) => row.map(cell).join(','))
    .join('\r\n')
}

const WORKFLOW_ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lens_ordered: RiBox3Line,
  fitting: RiSettings4Line,
  ready: RiShieldCheckLine,
  delivered: RiTruckLine,
}

/** A small colour chip for a patient, the same colours every time for the same name */
const PatientChip = ({ name }: { name: string }) => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return (
    <span
      aria-hidden
      className="size-5 shrink-0 rounded-[5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
      style={{ background: `linear-gradient(135deg, hsl(${hash} 85% 74%), hsl(${(hash + 55) % 360} 80% 60%))` }}
    />
  )
}

/** The order's status as a soft pill with a dot (the drawer keeps its own badge) */
const StatusPill = ({ status }: { status: SalesOrderStatus }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border-transparent px-2 py-0.5 text-xs font-medium', config.className, 'border-transparent')}>
      <span className="size-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  )
}

const readColumns = (): VisibilityState => {
  try {
    return JSON.parse(localStorage.getItem(COLUMNS_KEY) || '{}') as VisibilityState
  } catch {
    return {}
  }
}

const money = (value: number) => formatCurrency(value)
const dash = <span className="text-muted-foreground">—</span>

const SalesOrders = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep links (e.g. from notifications) can pre-select a tab: ?status=ready, ?status=overdue
  const urlTab = tabFromUrl(searchParams.get('status'))
  const [tab, setTab] = useState<TabId>(urlTab ?? 'all')
  useEffect(() => {
    if (urlTab) { setTab(urlTab); setPage(1) }
  }, [urlTab])
  const [search, setSearch] = useState('')
  // Searched on the server (order number, order ID, patient name or phone), not just this page
  const debouncedSearch = useDebounce(search.trim(), 300)
  const [patient, setPatient] = useState<PatientChoice | null>(null)
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter>('any')
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('any')
  const { confirm, confirmDialog } = useConfirm()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(readColumns)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [orderToEdit, setOrderToEdit] = useState<SalesOrder | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [findByReceiptOpen, setFindByReceiptOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Deep link from an invoice or notification: /sales-orders?detail=SO000123
  const urlDetail = searchParams.get('detail')
  useEffect(() => {
    if (urlDetail) setDetailOrderId(urlDetail)
  }, [urlDetail])

  const changeColumns = (next: VisibilityState) => {
    setColumnVisibility(next)
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(next))
    } catch {
      // Blocked storage: the choice lasts until the page is left
    }
  }

  // Everything the list is filtered and sorted by, except the page
  const filters = useMemo<SalesOrderListParams>(() => {
    const sort = sorting[0]
    return {
      status: tab !== 'all' && tab !== 'overdue' ? (tab as SalesOrderStatus) : undefined,
      overdue: tab === 'overdue' || undefined,
      search: debouncedSearch || undefined,
      patient_id: patient?.id,
      invoiced: invoiceFilter === 'any' ? undefined : invoiceFilter === 'yes',
      ...createdRange(createdFilter),
      sort_by: sort && SORTABLE.has(sort.id) ? (sort.id as SalesOrderListParams['sort_by']) : undefined,
      sort_dir: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
    }
  }, [createdFilter, debouncedSearch, invoiceFilter, patient?.id, sorting, tab])
  const listKey = useMemo(() => ['sales-orders', 'list', page, pageSize, filters] as const, [filters, page, pageSize])

  const rowStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SalesOrderStatus }) =>
      salesOrdersApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      setPendingRowId(id)
      await queryClient.cancelQueries({ queryKey: ['sales-orders'] })
      const previousData = queryClient.getQueryData(listKey)
      queryClient.setQueriesData({ queryKey: ['sales-orders'] }, (old: any) => {
        if (!Array.isArray(old?.data)) return old
        return { ...old, data: old.data.map((o: SalesOrder) => o.order_id === id ? { ...o, status } : o) }
      })
      return { previousData }
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousData) queryClient.setQueryData(listKey, context.previousData)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.error(error?.response?.data?.detail || 'Status update failed')
    },
    onSettled: (_data, _err, { id }) => {
      setPendingRowId(null)
      setSelectedOrderIds((prev) => prev.filter((sid) => sid !== id))
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-ready-count'] })
    },
  })

  const deleteDraftMutation = useMutation({
    mutationFn: (orderId: string) => salesOrdersApi.delete(orderId),
    onSuccess: () => {
      toast.success('Draft deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete draft')
    },
  })

  // Tab counts and the figures above the table; refreshed with the list (same key prefix)
  const { data: summary } = useQuery({
    queryKey: ['sales-orders', 'summary'],
    queryFn: () => salesOrdersApi.getSummary(),
    refetchInterval: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => salesOrdersApi.getAll({ page, page_size: pageSize, ...filters }),
    // Keep the rows on screen while the next page or filter loads
    placeholderData: keepPreviousData,
  })

  const { mutate: deleteDraftNow } = deleteDraftMutation
  const deleteDraft = useCallback(async (order: SalesOrder) => {
    const ok = await confirm({
      title: 'Delete draft order?',
      description: `This permanently removes draft ${order.order_number || 'this order'} and its unsaved progress. This can't be undone.`,
      confirmLabel: 'Delete draft',
      destructive: true,
    })
    if (ok) deleteDraftNow(order.order_id)
  }, [confirm, deleteDraftNow])

  const orders = useMemo(() => data?.data || [], [data?.data])

  const isAllSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.order_id))
  const isIndeterminate =
    selectedOrderIds.some((id) => orders.some((o) => o.order_id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.order_id)),
    [orders, selectedOrderIds],
  )

  const toggleAll = useCallback((checked: boolean) => {
    const visibleIds = orders.map((o) => o.order_id)
    if (checked) {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    }
  }, [orders])

  const toggleOne = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) =>
      checked ? [...prev, orderId] : prev.filter((id) => id !== orderId),
    )
  }

  const handleRowClick = (order: SalesOrder) => {
    setDetailOrderId(order.order_id)
  }

  const handleSortingChange = (updater: Updater<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPage(1)
      return next
    })
  }

  const chooseTab = (value: TabId) => {
    setTab(value)
    setPage(1)
    // A deep-linked tab gives way to the one chosen here
    if (searchParams.get('status')) {
      setSearchParams((prev) => { prev.delete('status'); return prev }, { replace: true })
    }
  }

  /**
   * Run an action on each selected order, one at a time (stock moves on status changes, so
   * they don't race), then report how many worked. The selection is cleared afterwards.
   */
  const runBulk = useCallback(async (
    rows: SalesOrder[],
    run: (order: SalesOrder) => Promise<unknown>,
    messages: { loading: string; done: (count: number) => string },
  ) => {
    const toastId = toast.loading(messages.loading)
    let done = 0
    const failed: string[] = []
    for (const order of rows) {
      try {
        await run(order)
        done += 1
      } catch {
        failed.push(order.order_number || order.order_id)
      }
    }
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    queryClient.invalidateQueries({ queryKey: ['sales-orders-drafts'] })
    queryClient.invalidateQueries({ queryKey: ['sales-orders-ready-count'] })
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    setSelectedOrderIds([])
    if (failed.length === 0) toast.success(messages.done(done), { id: toastId })
    else if (done > 0) toast.warning(`${messages.done(done)}. Not done: ${failed.join(', ')}`, { id: toastId })
    else toast.error(`Nothing changed. Not done: ${failed.join(', ')}`, { id: toastId })
  }, [queryClient])

  /** The selected orders, or with none selected every order the tab and filters show */
  const exportOrders = async () => {
    if (selectedRows.length > 0) {
      downloadFile(new Blob(['﻿' + ordersCsv(selectedRows)], { type: 'text/csv;charset=utf-8' }), `sales-orders-${localDateString()}.csv`)
      toast.success(`${plural(selectedRows.length, 'order')} exported`)
      return
    }
    setExporting(true)
    try {
      const all: SalesOrder[] = []
      // 100 a page (the API's limit), up to 5,000 orders
      for (let next = 1; next <= 50; next += 1) {
        const result = await salesOrdersApi.getAll({ ...filters, page: next, page_size: 100 })
        all.push(...result.data)
        if (next >= result.total_pages) break
      }
      downloadFile(new Blob(['﻿' + ordersCsv(all)], { type: 'text/csv;charset=utf-8' }), `sales-orders-${localDateString()}.csv`)
      toast.success(`${plural(all.length, 'order')} exported`)
    } catch {
      toast.error('Export failed. Try again.')
    } finally {
      setExporting(false)
    }
  }

  // Each order moves to its own next step, so a mixed selection can be advanced together
  const advanceable = useMemo(() => selectedRows.filter((o) => getNextAction(o.status)), [selectedRows])
  const commonNextAction = useMemo(() => {
    const labels = new Set(advanceable.map((o) => getNextAction(o.status)?.label))
    return advanceable.length > 0 && labels.size === 1 ? getNextAction(advanceable[0].status) : null
  }, [advanceable])
  const cancellable = useMemo(() => selectedRows.filter((o) => CANCELLABLE.includes(o.status)), [selectedRows])
  const deletableDrafts = useMemo(() => selectedRows.filter((o) => o.status === 'draft' && !o.invoice_id), [selectedRows])

  const rowActions = useMemo<RowAction<SalesOrder>[]>(() => {
    const actions: RowAction<SalesOrder>[] = []
    const multi = selectedRows.length > 1

    // The next step comes first and stands out
    if (advanceable.length > 0) {
      const Icon = commonNextAction ? (WORKFLOW_ACTION_ICONS[commonNextAction.toStatus] ?? RiBox3Line) : RiArrowRightLine
      const label = commonNextAction?.label ?? 'Move to next step'
      actions.push({
        id: 'workflow-next',
        label: multi ? `${label} (${advanceable.length})` : label,
        icon: Icon,
        primary: true,
        onClick: () => runBulk(advanceable, (o) => salesOrdersApi.updateStatus(o.order_id, getNextAction(o.status)!.toStatus), {
          loading: `Updating ${plural(advanceable.length, 'order')}…`,
          done: (n) => (commonNextAction ? `${plural(n, 'order')} moved to "${commonNextAction.label}"` : `${plural(n, 'order')} moved to the next step`),
        }),
      })
    }

    // One order: edit or continue it, open it, see its invoice
    actions.push({
      id: 'edit-order',
      label: selectedRows[0]?.status === 'draft' ? 'Continue draft' : 'Edit order',
      icon: RiFileEditLine,
      showWhen: 'single',
      primary: advanceable.length === 0,
      onClick: (rows) => {
        const order = rows[0]
        if (order.status === 'draft') navigate(`/sales-orders/assistant?draft=${order.order_id}`)
        else setOrderToEdit(order)
      },
    })
    actions.push({
      id: 'view-details',
      label: 'View details',
      icon: RiEyeLine,
      showWhen: 'single',
      onClick: (rows) => setDetailOrderId(rows[0].order_id),
    })
    if (selectedRows.length === 1 && selectedRows[0]?.invoice_id) {
      actions.push({
        id: 'view-invoice',
        label: 'View invoice',
        icon: RiReceiptLine,
        showWhen: 'single',
        onClick: (rows) => { if (rows[0].invoice_id) navigate(`/invoices?detail=${rows[0].invoice_id}`) },
      })
    }

    // Any number of orders
    actions.push({
      id: 'download-pdf',
      label: multi ? `Download ${selectedRows.length} PDFs` : 'Download PDF',
      icon: RiDownloadLine,
      onClick: (rows) => runBulk(rows, async (o) => {
        downloadFile(await salesOrdersApi.downloadPDF(o.order_id), `${o.order_number}.pdf`)
      }, {
        loading: `Preparing ${plural(rows.length, 'PDF')}…`,
        done: (n) => `${plural(n, 'PDF')} downloaded`,
      }),
    })
    actions.push({
      id: 'export-csv',
      label: multi ? `Export ${selectedRows.length} to spreadsheet` : 'Export to spreadsheet',
      icon: RiFileExcel2Line,
      onClick: (rows) => {
        // A byte-order mark so Excel reads names as UTF-8
        downloadFile(new Blob(['﻿' + ordersCsv(rows)], { type: 'text/csv;charset=utf-8' }), `sales-orders-${localDateString()}.csv`)
        toast.success(`${plural(rows.length, 'order')} exported`)
      },
    })

    // Destructive, last and apart; each asks first and says what it will leave alone
    if (cancellable.length > 0) {
      actions.push({
        id: 'cancel-orders',
        label: multi ? `Cancel ${plural(cancellable.length, 'order')}` : 'Cancel order',
        icon: RiCloseCircleLine,
        destructive: true,
        onClick: async (rows) => {
          const skipped = rows.length - cancellable.length
          const ok = await confirm({
            title: `Cancel ${plural(cancellable.length, 'order')}?`,
            description: `${cancellable.map((o) => o.order_number).join(', ')}: stock goes back and any invoice is voided. This can't be undone.${skipped ? ` ${plural(skipped, 'other selected order')} (draft, delivered or already cancelled) will be left as they are.` : ''}`,
            confirmLabel: `Cancel ${plural(cancellable.length, 'order')}`,
            cancelLabel: 'Keep orders',
            destructive: true,
          })
          if (!ok) return
          runBulk(cancellable, (o) => salesOrdersApi.updateStatus(o.order_id, 'cancelled'), {
            loading: `Cancelling ${plural(cancellable.length, 'order')}…`,
            done: (n) => `${plural(n, 'order')} cancelled`,
          })
        },
      })
    }
    if (deletableDrafts.length > 0) {
      actions.push({
        id: 'delete-drafts',
        label: multi ? `Delete ${plural(deletableDrafts.length, 'draft')}` : 'Delete draft',
        icon: RiDeleteBin6Line,
        destructive: true,
        onClick: async (rows) => {
          const skipped = rows.length - deletableDrafts.length
          const ok = await confirm({
            title: `Delete ${plural(deletableDrafts.length, 'draft')}?`,
            description: `${deletableDrafts.map((o) => o.order_number).join(', ')} and their unsaved progress will be removed permanently. This can't be undone.${skipped ? ` ${plural(skipped, 'other selected order')} that are not drafts will be left as they are.` : ''}`,
            confirmLabel: `Delete ${plural(deletableDrafts.length, 'draft')}`,
            cancelLabel: 'Keep drafts',
            destructive: true,
          })
          if (!ok) return
          runBulk(deletableDrafts, (o) => salesOrdersApi.delete(o.order_id), {
            loading: `Deleting ${plural(deletableDrafts.length, 'draft')}…`,
            done: (n) => `${plural(n, 'draft')} deleted`,
          })
        },
      })
    }

    return actions
  }, [advanceable, cancellable, commonNextAction, confirm, deletableDrafts, navigate, runBulk, selectedRows])

  const columns = useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all orders"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.order_number}`}
            checked={selectedOrderIds.includes(row.original.order_id)}
            onCheckedChange={(checked) => toggleOne(row.original.order_id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'order_number',
        header: 'Order',
        meta: {
          icon: RiHashtag,
          summary: { type: 'text', value: (order) => order.order_number },
        },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="link"
            title={row.original.order_id}
            className="h-auto p-0 font-normal text-foreground underline-offset-2"
            onClick={(e) => { e.stopPropagation(); setDetailOrderId(row.original.order_id) }}
          >
            {row.original.order_number}
          </Button>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        enableSorting: false,
        meta: {
          icon: RiUser3Line,
          summary: { type: 'text', value: (order) => order.patient_name || order.patient_id },
        },
        cell: ({ row }) => {
          const name = row.original.patient_name || row.original.patient_id
          return (
            <span className="flex max-w-56 items-center gap-2.5" title={row.original.patient_id}>
              <PatientChip name={name} />
              <span className="truncate text-foreground">{name}</span>
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          icon: RiProgress3Line,
          summary: { type: 'text', value: (order) => STATUS_CONFIG[order.status]?.label ?? order.status },
        },
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        meta: {
          icon: RiMoneyDollarCircleLine,
          summary: { type: 'number', value: orderTotal, format: money },
        },
        cell: ({ row }) => <span className="tabular-nums text-foreground">{money(orderTotal(row.original))}</span>,
      },
      {
        id: 'paid_amount',
        header: 'Paid',
        enableSorting: false,
        meta: {
          icon: RiCheckboxCircleLine,
          summary: { type: 'number', value: (order) => order.paid_amount ?? null, format: money },
        },
        cell: ({ row }) => (row.original.paid_amount ? <span className="tabular-nums">{money(row.original.paid_amount)}</span> : dash),
      },
      {
        id: 'balance_due',
        header: 'Balance',
        enableSorting: false,
        meta: {
          icon: RiScales3Line,
          summary: { type: 'number', value: (order) => order.balance_due ?? null, format: money },
        },
        cell: ({ row }) => (row.original.balance_due ? <span className="tabular-nums text-foreground">{money(row.original.balance_due)}</span> : dash),
      },
      {
        accessorKey: 'expected_delivery_date',
        header: 'Delivery',
        meta: {
          icon: RiCalendarScheduleLine,
          summary: { type: 'date', value: (order) => order.expected_delivery_date ?? null },
        },
        cell: ({ row }) => {
          const when = row.original.expected_delivery_date
          if (!when) return dash
          const late = isLate(row.original)
          return (
            <span className={cn('tabular-nums', late && 'font-medium text-destructive')} title={late ? 'Past the promised delivery date' : undefined}>
              {formatDate(when, 'MMM d, yyyy')}
            </span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        meta: {
          icon: RiCalendarLine,
          summary: { type: 'date', value: (order) => order.created_at ?? null },
        },
        cell: ({ row }) => {
          const d = row.original.created_at ? new Date(row.original.created_at) : null
          if (!d) return dash
          return (
            <span className="tabular-nums" title={d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}>
              {formatDate(d, 'MMM d, yyyy')}
            </span>
          )
        },
      },
      {
        id: 'items',
        header: 'Items',
        enableSorting: false,
        meta: {
          icon: RiShoppingBag3Line,
          summary: { type: 'number', value: (order) => order.items.length },
        },
        cell: ({ row }) => <span className="tabular-nums">{row.original.items.length}</span>,
      },
      {
        id: 'invoice',
        header: 'Invoice',
        enableSorting: false,
        meta: {
          icon: RiReceiptLine,
          summary: { type: 'text', value: (order) => order.invoice_id ?? null },
        },
        cell: ({ row }) =>
          row.original.invoice_id ? (
            <Button
              variant="link"
              className="h-auto p-0 font-normal"
              onClick={() => navigate(`/invoices?detail=${row.original.invoice_id}`)}
            >
              View invoice
            </Button>
          ) : (
            dash
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { sticky: 'right', label: 'Actions' },
        cell: ({ row }) => {
          const order = row.original
          const nextAction = getNextAction(order.status)
          const isRowPending = pendingRowId === order.order_id
          const Icon = nextAction
            ? (WORKFLOW_ACTION_ICONS[nextAction.toStatus] ?? RiBox3Line)
            : null

          return (
            <div className="flex items-center gap-1.5 justify-end">
              {/* Primary inline workflow action — always visible */}
              {nextAction && Icon && (
                <Button
                  size="sm"
                  disabled={isRowPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    rowStatusMutation.mutate(
                      { id: order.order_id, status: nextAction.toStatus },
                      {
                        onSuccess: () =>
                          toast.success(`"${order.order_number}" → ${nextAction.label}`),
                      },
                    )
                  }}
                  className={cn(
                    'h-7 font-medium shadow-none',
                    nextAction.className,
                  )}
                >
                  {isRowPending ? <RiLoader4Line className="animate-spin" /> : <Icon />}
                  {nextAction.label}
                </Button>
              )}

              {/* Drafts pick up in the assistant where they were left */}
              {order.status === 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/sales-orders/assistant?draft=${order.order_id}`)
                  }}
                >
                  <RiFileEditLine />
                  Continue
                </Button>
              )}

              {/* Utility-only ellipsis */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 data-[state=open]:bg-muted"
                    aria-label="More actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RiMore2Line className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setDetailOrderId(order.order_id)}>
                    <RiEyeLine className="size-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const blob = await salesOrdersApi.downloadPDF(order.order_id)
                        downloadFile(blob, `${order.order_number}.pdf`)
                        toast.success('PDF downloaded')
                      } catch {
                        toast.error('Failed to download PDF')
                      }
                    }}
                  >
                    <RiDownloadLine className="size-4" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (order.status === 'draft') {
                        navigate(`/sales-orders/assistant?draft=${order.order_id}`)
                      } else {
                        setOrderToEdit(order)
                      }
                    }}
                  >
                    <RiFileEditLine className="size-4" />
                    Edit Order
                  </DropdownMenuItem>
                  {order.invoice_id && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/invoices?detail=${order.invoice_id}`)}
                    >
                      <RiReceiptLine className="size-4" />
                      View Invoice
                    </DropdownMenuItem>
                  )}
                  {order.status === 'draft' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteDraft(order)}
                      >
                        <RiDeleteBin6Line className="size-4" />
                        Delete Draft
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [isAllSelected, isIndeterminate, selectedOrderIds, pendingRowId, navigate, rowStatusMutation, toggleAll, deleteDraft],
  )

  const counts = summary?.counts

  return (
    // The page fills the space under the app header, edge to edge; only the table scrolls
    <div className="-m-4 flex h-[calc(100svh-4rem)] min-h-[32rem] flex-col overflow-hidden bg-background md:-m-8">
      {/* Edit order confirmation (non-draft orders) */}
      <AlertDialog open={!!orderToEdit} onOpenChange={(open) => { if (!open) setOrderToEdit(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{orderToEdit?.order_number}</strong> has already been processed (status:{' '}
              <strong>{orderToEdit?.status?.replace(/_/g, ' ')}</strong>). Editing it may affect
              linked inventory, prescriptions, or invoices. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToEdit(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToEdit) navigate(`/sales-orders/assistant?draft=${orderToEdit.order_id}`)
                setOrderToEdit(null)
              }}
            >
              Edit Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {confirmDialog}

      <FindOrderByReceiptDialog open={findByReceiptOpen} onOpenChange={setFindByReceiptOpen} onFound={setDetailOrderId} />

      {/* Sales order detail sheet */}
      <SalesOrderDetailSheet
        orderId={detailOrderId}
        open={!!detailOrderId}
        onOpenChange={(open) => {
          if (open) return
          setDetailOrderId(null)
          if (searchParams.get('detail')) {
            setSearchParams((prev) => { prev.delete('detail'); return prev }, { replace: true })
          }
        }}
      />

      {/* Title bar; the selection's actions appear here while orders are ticked */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <RiFileList3Line className="size-4 text-muted-foreground" />
        <h1 className="text-sm font-medium text-foreground">Sales Orders</h1>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <DataTableSelectionBar
            selectedRows={selectedRows}
            rowActions={rowActions}
            onClearSelection={() => setSelectedOrderIds([])}
            className="min-w-0 border-r border-border pr-2"
          />
          <Button size="sm" variant="outline" onClick={() => setFindByReceiptOpen(true)}>
            <RiBarcodeLine />
            <span className="hidden sm:inline">Scan invoice</span>
          </Button>
        </div>
      </div>

      {/* Status tabs on the left; search, filters, view and the main actions on the right */}
      {/* One row where there's room; on narrower screens the tools wrap under the tabs, still on the right */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2">
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(value) => { if (value) chooseTab(value as TabId) }}
          aria-label="Filter by status"
          className="min-w-0 max-w-full flex-auto justify-start gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((item) => {
            const count = counts?.[item.id]
            const urgent = (item.id === 'overdue' || item.id === 'ready') && !!count
            return (
              <ToggleGroupItem
                key={item.id}
                value={item.id}
                className="h-8 shrink-0 gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[state=on]:border-border data-[state=on]:bg-muted/60 data-[state=on]:text-foreground data-[state=on]:shadow-xs"
              >
                {item.label}
                {count !== undefined && (
                  <span
                    className={cn(
                      'tabular-nums text-muted-foreground',
                      urgent && item.id === 'overdue' && 'font-medium text-destructive',
                      urgent && item.id === 'ready' && 'font-medium text-warning',
                    )}
                  >
                    {count}
                  </span>
                )}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <InputGroup className="h-8 w-full bg-background sm:w-52">
            <InputGroupAddon>
              <RiSearchLine />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Search orders"
              aria-label="Search orders by number, patient name or phone"
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1) }}>
                  <RiCloseLine />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <PatientFilter value={patient} onChange={(next) => { setPatient(next); setPage(1) }} />
          <OrderFilterMenu
            compact
            created={createdFilter}
            invoice={invoiceFilter}
            onCreatedChange={(value) => { setCreatedFilter(value); setPage(1) }}
            onInvoiceChange={(value) => { setInvoiceFilter(value); setPage(1) }}
          />
          <DataTableViewMenu columns={columns} columnVisibility={columnVisibility} onColumnVisibilityChange={changeColumns} />
          <Separator orientation="vertical" className="mx-0.5 hidden h-5 sm:block" />
          <Button variant="ghost" size="sm" onClick={exportOrders} disabled={exporting} title={selectedRows.length ? 'Export the selected orders' : 'Export every order in this view'}>
            {exporting ? <RiLoader4Line className="animate-spin" /> : <RiDownload2Line />}
            Export
          </Button>
          <Button size="sm" onClick={() => navigate('/sales-orders/assistant')}>
            <RiAddLine />
            New sales order
          </Button>
        </div>
      </div>

      <SalesOrderKpiStrip summary={summary} />

      <DataTable
        variant="grid"
        columns={columns}
        data={orders}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        globalFilter={search}
        onGlobalFilterChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        loading={isLoading}
        selectedRows={selectedRows}
        rowActions={rowActions}
        onRowClick={handleRowClick}
        isRowActive={(order) => order.order_id === detailOrderId}
        onClearSelection={() => setSelectedOrderIds([])}
        emptyMessage={tab === 'overdue' ? 'Nothing is late. Every order is on time.' : 'No sales orders found.'}
        rowNumberStart={(page - 1) * pageSize + 1}
        summaryStorageKey="sales-orders.calculate"
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={changeColumns}
      />
      {data && data.total > 0 && (
        <div className="shrink-0 [&>div]:py-2">
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
        </div>
      )}
    </div>
  )
}

export default SalesOrders
