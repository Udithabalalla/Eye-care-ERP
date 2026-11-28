import * as React from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  RiArrowDownLine,
  RiArrowDownSLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCloseLine,
  RiEqualizerLine,
  RiMore2Line,
} from '@remixicon/react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** What a column's "Calculate" footer can work out over the rows on screen (grid look) */
export type ColumnSummary<TData> = {
  /** 'number' adds sum, average, min and max; 'date' adds earliest and latest; every type can count */
  type: 'number' | 'text' | 'date'
  value: (row: TData) => number | string | Date | null | undefined
  /** How a number result reads (an amount, say). Counts are always plain numbers. */
  format?: (value: number) => string
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the generics must match TanStack's declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Keep the column in view at the table's right edge while the rest scrolls sideways (row actions) */
    sticky?: 'right'
    /** Grid look: a small icon before the column name */
    icon?: React.ComponentType<{ className?: string }>
    /** The column's name where the header isn't plain text (column menus) */
    label?: string
    /** Grid look: what the Calculate footer can work out for this column */
    summary?: ColumnSummary<TData>
  }
}

// A pinned cell sits over the scrolling ones, so it needs an opaque background that
// follows the row's hover / selected / open-in-drawer colours
const STICKY_RIGHT =
  'sticky right-0 z-[1] bg-card group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] group-data-[state=selected]/row:bg-muted'
// Edge shadow, only while columns are scrolled out of sight under the pinned one
const STICKY_EDGE = 'shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.2)]'
const STICKY_ACTIVE = 'bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]'
// The grid sits on the page background, so its pinned cells match that instead of the card.
// Pinned from tablet width up: on a phone the actions would cover the rest of the row.
const GRID_STICKY_RIGHT =
  'md:sticky md:right-0 z-[1] bg-background group-hover/row:bg-[color-mix(in_oklab,var(--muted)_40%,var(--background))] group-data-[state=selected]/row:bg-muted'
const GRID_STICKY_EDGE = 'md:shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.2)]'
const GRID_STICKY_ACTIVE = 'bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))]'

// The row-number column the grid look adds after the checkboxes
const ROW_NUMBER_ID = '__row_number'

export type RowAction<TData> = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (rows: TData[]) => void
  /** 'single' = only when 1 row selected, 'multiple' = only when 2+, 'any' = always. Defaults to 'any'. */
  showWhen?: 'single' | 'multiple' | 'any'
  /** Show as a top-level button in the selection bar instead of in its ⋯ menu. Defaults to false. */
  primary?: boolean
  /** A destructive action (delete, cancel): listed last in the menu, apart, in the destructive colour */
  destructive?: boolean
}

// The column's own header when it is plain text ("Order #"), else its id made readable
// ("expected_delivery_date" → "Expected delivery date")
const columnLabel = (id: string, header: unknown, label?: string) => {
  if (label) return label
  if (typeof header === 'string' && header.trim()) return header
  const words = id.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const columnId = <TData, TValue>(column: ColumnDef<TData, TValue>) =>
  column.id ?? ('accessorKey' in column && typeof column.accessorKey === 'string' ? column.accessorKey : '')

// ── Selection bar ─────────────────────────────────────────────────────────────

type SelectionBarProps<TData> = {
  selectedRows: TData[]
  rowActions?: RowAction<TData>[]
  onClearSelection?: () => void
  className?: string
}

/** "3 selected" with the actions for those rows: the default toolbar shows it next to search; a page with its own toolbar can place it */
export function DataTableSelectionBar<TData>({ selectedRows, rowActions, onClearSelection, className }: SelectionBarProps<TData>) {
  const selectionCount = selectedRows.length

  const applicableActions = React.useMemo(() => {
    if (!rowActions || selectionCount === 0) return []
    return rowActions.filter((action) => {
      if (!action.showWhen || action.showWhen === 'any') return true
      if (action.showWhen === 'single') return selectionCount === 1
      if (action.showWhen === 'multiple') return selectionCount > 1
      return true
    })
  }, [rowActions, selectionCount])

  if (selectionCount === 0) return null

  const primaryActions = applicableActions.filter((a) => a.primary)
  // The ⋯ menu holds what isn't already a button; destructive actions go last, apart
  const menuActions = applicableActions.filter((a) => !a.primary && !a.destructive)
  const destructiveActions = applicableActions.filter((a) => !a.primary && a.destructive)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {selectionCount} selected
      </span>
      <ButtonGroup>
        {primaryActions.map((action) => {
          const Icon = action.icon
          return (
            <Button key={action.id} variant="outline" size="sm" onClick={() => action.onClick(selectedRows)}>
              {Icon && <Icon className="size-3.5" />}
              {action.label}
            </Button>
          )
        })}
        {menuActions.length + destructiveActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <RiMore2Line className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {menuActions.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem key={action.id} onClick={() => action.onClick(selectedRows)}>
                    {Icon && <Icon className="size-4" />}
                    {action.label}
                  </DropdownMenuItem>
                )
              })}
              {menuActions.length > 0 && destructiveActions.length > 0 && <DropdownMenuSeparator />}
              {destructiveActions.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.id}
                    className="text-destructive focus:text-destructive"
                    onClick={() => action.onClick(selectedRows)}
                  >
                    {Icon && <Icon className="size-4" />}
                    {action.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </ButtonGroup>
      {onClearSelection && (
        <Button variant="ghost" size="icon-sm" onClick={onClearSelection} aria-label="Clear selection">
          <RiCloseLine className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

// ── Edit view (show / hide columns) ───────────────────────────────────────────

type ViewMenuProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (next: VisibilityState) => void
  trigger?: React.ReactNode
}

/** The columns a person can show or hide, for a page that keeps the table's column visibility */
export function DataTableViewMenu<TData, TValue>({ columns, columnVisibility, onColumnVisibilityChange, trigger }: ViewMenuProps<TData, TValue>) {
  const hideable = columns.filter((column) => column.enableHiding !== false && columnId(column))
  const shown = (id: string) => columnVisibility[id] !== false
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <RiEqualizerLine className="size-4" />
            Edit view
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Columns to show</DropdownMenuLabel>
        {hideable.map((column) => {
          const id = columnId(column)
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={shown(id)}
              // Keep the menu open, so several columns can be switched in one go
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(value) => onColumnVisibilityChange({ ...columnVisibility, [id]: Boolean(value) })}
            >
              {columnLabel(id, column.header, column.meta?.label)}
            </DropdownMenuCheckboxItem>
          )
        })}
        {hideable.some((column) => !shown(columnId(column))) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onColumnVisibilityChange({})}>Show all columns</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Calculate footer ──────────────────────────────────────────────────────────

type SummaryKind = 'count' | 'empty' | 'filled' | 'unique' | 'sum' | 'average' | 'min' | 'max' | 'earliest' | 'latest'

const SUMMARY_LABELS: Record<SummaryKind, string> = {
  count: 'Count all',
  empty: 'Count empty',
  filled: 'Count filled',
  unique: 'Count unique',
  sum: 'Sum',
  average: 'Average',
  min: 'Min',
  max: 'Max',
  earliest: 'Earliest',
  latest: 'Latest',
}
// The word shown in front of the result in the footer
const SUMMARY_SHORT: Record<SummaryKind, string> = {
  count: 'Count',
  empty: 'Empty',
  filled: 'Filled',
  unique: 'Unique',
  sum: 'Sum',
  average: 'Avg',
  min: 'Min',
  max: 'Max',
  earliest: 'Earliest',
  latest: 'Latest',
}

const summaryKinds = (type: ColumnSummary<unknown>['type']): SummaryKind[] => [
  'count', 'empty', 'filled', 'unique',
  ...(type === 'number' ? (['sum', 'average', 'min', 'max'] as SummaryKind[]) : []),
  ...(type === 'date' ? (['earliest', 'latest'] as SummaryKind[]) : []),
]

const isEmpty = (value: unknown) => value === null || value === undefined || value === ''

function calculate<TData>(summary: ColumnSummary<TData>, kind: SummaryKind, rows: TData[]): string {
  const values = rows.map(summary.value)
  const filled = values.filter((v) => !isEmpty(v))
  const count = (n: number) => n.toLocaleString()
  switch (kind) {
    case 'count': return count(values.length)
    case 'empty': return count(values.length - filled.length)
    case 'filled': return count(filled.length)
    case 'unique': return count(new Set(filled.map((v) => (v instanceof Date ? v.getTime() : String(v)))).size)
    default: break
  }
  if (kind === 'earliest' || kind === 'latest') {
    const times = filled.map((v) => new Date(v as string | Date).getTime()).filter((t) => !Number.isNaN(t))
    if (!times.length) return '—'
    const when = new Date(kind === 'earliest' ? Math.min(...times) : Math.max(...times))
    return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const numbers = filled.map(Number).filter((n) => Number.isFinite(n))
  if (!numbers.length) return '—'
  const result = kind === 'sum'
    ? numbers.reduce((a, b) => a + b, 0)
    : kind === 'average'
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : kind === 'min' ? Math.min(...numbers) : Math.max(...numbers)
  return summary.format ? summary.format(result) : result.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const readChoices = (key?: string): Record<string, SummaryKind> => {
  if (!key) return {}
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, SummaryKind>
  } catch {
    return {}
  }
}

function SummaryCell<TData>({ summary, rows, choice, onChoose }: {
  summary: ColumnSummary<TData>
  rows: TData[]
  choice?: SummaryKind
  onChoose: (kind: SummaryKind | null) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-full justify-start gap-1.5 px-2 font-normal',
            choice ? 'text-foreground' : 'text-muted-foreground/80 hover:text-foreground',
          )}
        >
          {choice ? (
            <>
              <span className="text-muted-foreground">{SUMMARY_SHORT[choice]}</span>
              <span className="truncate tabular-nums">{calculate(summary, choice, rows)}</span>
            </>
          ) : (
            <>
              <RiArrowDownSLine className="size-4" />
              Calculate
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Rows on this page</DropdownMenuLabel>
        {summaryKinds(summary.type).map((kind) => (
          <DropdownMenuItem key={kind} onClick={() => onChoose(kind)}>
            {SUMMARY_LABELS[kind]}
            {choice === kind && <RiCheckLine className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        {choice && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChoose(null)}>None</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  loading?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  /** Currently selected row data — drives the contextual action bar. */
  selectedRows?: TData[]
  /** Actions available for selected rows, shown in the button group next to search. */
  rowActions?: RowAction<TData>[]
  /** Called when clicking a row body (not interactive elements). Use to toggle row selection. */
  onRowClick?: (row: TData) => void
  /** Called when the × clear button in the action bar is clicked. */
  onClearSelection?: () => void
  /** Marks the row whose details are open in a drawer, so the user can see which one it is. */
  isRowActive?: (row: TData) => boolean
  /**
   * 'grid': the invoices-style look — ruled columns, icons before column names, numbered rows,
   * headers that sort, and a Calculate footer. The page draws its own toolbar (search,
   * selection bar, Edit view), so the table shows none. It fills the height it's given and
   * scrolls inside it, header and footer pinned.
   */
  variant?: 'default' | 'grid'
  /** Grid: the number of the first row on this page (rows on earlier pages + 1) */
  rowNumberStart?: number
  /** Grid: remember each column's Calculate choice in this browser under this key */
  summaryStorageKey?: string
  /** Column visibility kept by the page (with DataTableViewMenu); the table keeps its own otherwise */
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (next: VisibilityState) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
  loading = false,
  emptyMessage = 'No results found',
  searchPlaceholder = 'Search...',
  className,
  selectedRows,
  rowActions,
  onRowClick,
  onClearSelection,
  isRowActive,
  variant = 'default',
  rowNumberStart = 1,
  summaryStorageKey,
  columnVisibility: controlledVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const grid = variant === 'grid'
  const [ownVisibility, setOwnVisibility] = React.useState<VisibilityState>({})
  const columnVisibility = controlledVisibility ?? ownVisibility
  const tableWrapRef = React.useRef<HTMLDivElement>(null)
  const [columnsHidden, setColumnsHidden] = React.useState(false)
  const [summaryChoices, setSummaryChoices] = React.useState<Record<string, SummaryKind>>(() => readChoices(summaryStorageKey))

  const chooseSummary = (id: string, kind: SummaryKind | null) => {
    setSummaryChoices((prev) => {
      const next = { ...prev }
      if (kind) next[id] = kind
      else delete next[id]
      if (summaryStorageKey) {
        try {
          localStorage.setItem(summaryStorageKey, JSON.stringify(next))
        } catch {
          // Private windows and blocked storage: the choice lasts until the page is left
        }
      }
      return next
    })
  }

  // Is part of the table scrolled out of view to the right (under a pinned column)?
  React.useEffect(() => {
    const scroller = tableWrapRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!scroller) return
    const update = () => setColumnsHidden(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1)
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(scroller)
    const table = scroller.querySelector('table')
    if (table) resize.observe(table)
    return () => {
      scroller.removeEventListener('scroll', update)
      resize.disconnect()
    }
  }, [])

  // The grid numbers its rows in a column of their own, just after the checkboxes
  const tableColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!grid) return columns
    const numberColumn: ColumnDef<TData, TValue> = {
      id: ROW_NUMBER_ID,
      header: () => <span className="sr-only">Row</span>,
      cell: ({ row }) => rowNumberStart + row.index,
      enableSorting: false,
      enableHiding: false,
    }
    const at = columns.findIndex((column) => column.id === 'select')
    return [...columns.slice(0, at + 1), numberColumn, ...columns.slice(at + 1)]
  }, [columns, grid, rowNumberStart])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange,
    onGlobalFilterChange: (value) => onGlobalFilterChange(String(value ?? '')),
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater
      if (onColumnVisibilityChange) onColumnVisibilityChange(next)
      else setOwnVisibility(next)
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    enableSortingRemoval: true,
  })

  const rows = table.getRowModel().rows
  const visibleColumnCount = table.getVisibleLeafColumns().length || tableColumns.length
  const selectionCount = selectedRows?.length ?? 0

  const rowIsSelected = (row: Row<TData>) => row.getIsSelected() || !!selectedRows?.includes(row.original)

  const handleRowClick = (event: React.MouseEvent, row: Row<TData>) => {
    if (!onRowClick) return
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, [role="checkbox"], [role="menuitem"], [role="menu"]')) return
    onRowClick(row.original)
  }

  if (grid) {
    const pageRows = rows.map((row) => row.original)
    const hasSummaries = table.getVisibleLeafColumns().some((column) => column.columnDef.meta?.summary)
    return (
      <div
        ref={tableWrapRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          // The table scrolls inside the space it's given; header and footer stay put
          '[&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-auto',
          className,
        )}
      >
        <Table className="border-separate border-spacing-0 text-sm">
          <TableHeader className="[&_tr]:border-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const Icon = meta?.icon
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  const isCheckbox = header.column.id === 'select'
                  const isNumber = header.column.id === ROW_NUMBER_ID
                  const name = flexRender(header.column.columnDef.header, header.getContext())
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'sticky top-0 z-[2] h-11 border-b border-r border-border bg-background px-3 font-normal text-muted-foreground last:border-r-0',
                        (isCheckbox || isNumber) && 'w-11 min-w-[2.75rem] px-0 text-center [&:has([role=checkbox])]:pr-0',
                        meta?.sticky === 'right' && ['md:right-0 z-[3]', columnsHidden && GRID_STICKY_EDGE],
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 gap-2 px-2 font-normal text-muted-foreground hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {Icon && <Icon className="size-4" />}
                          {name}
                          {sorted === 'asc' && <RiArrowUpLine className="size-3.5 text-foreground" />}
                          {sorted === 'desc' && <RiArrowDownLine className="size-3.5 text-foreground" />}
                        </Button>
                      ) : (
                        <span className={cn('inline-flex items-center gap-2', isCheckbox && 'justify-center')}>
                          {Icon && <Icon className="size-4" />}
                          {name}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-0">
            {loading ? (
              Array.from({ length: 8 }, (_, index) => (
                <TableRow key={index} className="border-0 hover:bg-transparent">
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell key={column.id} className="h-12 border-b border-r border-border px-3 last:border-r-0">
                      <Skeleton className={cn('h-3.5', column.id === 'select' || column.id === ROW_NUMBER_ID ? 'mx-auto w-4' : 'w-3/4')} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const active = isRowActive?.(row.original)
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'group/row border-0 hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                      active && 'bg-primary/5 hover:bg-primary/10',
                    )}
                    // Clicking another row swaps an open detail drawer instead of dismissing it
                    data-keeps-drawer-open={onRowClick ? '' : undefined}
                    data-state={rowIsSelected(row) ? 'selected' : undefined}
                    onClick={(event) => handleRowClick(event, row)}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const sticky = cell.column.columnDef.meta?.sticky === 'right'
                      const narrow = cell.column.id === 'select' || cell.column.id === ROW_NUMBER_ID
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'h-12 border-b border-r border-border px-3 last:border-r-0',
                            narrow && 'w-11 min-w-[2.75rem] px-0 text-center [&:has([role=checkbox])]:pr-0',
                            cell.column.id === ROW_NUMBER_ID && 'tabular-nums text-muted-foreground',
                            // The open row is marked down its left edge
                            index === 0 && active && 'shadow-[inset_3px_0_0_var(--primary)]',
                            sticky && [GRID_STICKY_RIGHT, columnsHidden && GRID_STICKY_EDGE],
                            sticky && active && GRID_STICKY_ACTIVE,
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="h-32 border-b border-border text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {hasSummaries && (
            <TableFooter className="border-0 bg-transparent font-normal">
              <TableRow className="border-0 hover:bg-transparent">
                {table.getVisibleLeafColumns().map((column) => {
                  const summary = column.columnDef.meta?.summary
                  const sticky = column.columnDef.meta?.sticky === 'right'
                  return (
                    <TableCell
                      key={column.id}
                      className={cn(
                        'sticky bottom-0 z-[2] h-11 border-r border-t border-border bg-background px-1 last:border-r-0',
                        sticky && ['md:right-0 z-[3]', columnsHidden && GRID_STICKY_EDGE],
                      )}
                    >
                      {summary && (
                        <SummaryCell
                          summary={summary}
                          rows={pageRows}
                          choice={summaryChoices[column.id]}
                          onChoose={(kind) => chooseSummary(column.id, kind)}
                        />
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="max-w-sm"
          aria-label="Search table records"
        />

        {selectionCount > 0 && (
          <DataTableSelectionBar
            className="pl-2 border-l border-border"
            selectedRows={selectedRows!}
            rowActions={rowActions}
            onClearSelection={onClearSelection}
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <RiArrowDownSLine className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                >
                  {columnLabel(column.id, column.columnDef.header, column.columnDef.meta?.label)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={tableWrapRef} className="mb-4 rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="z-0">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn('z-0', header.column.columnDef.meta?.sticky === 'right' && ['sticky right-0 z-[1] bg-card', columnsHidden && STICKY_EDGE])}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('group/row z-0', onRowClick && 'cursor-pointer', isRowActive?.(row.original) && 'bg-primary/5 shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10')}
                  // Clicking another row swaps an open detail drawer instead of dismissing it
                  data-keeps-drawer-open={onRowClick ? '' : undefined}
                  data-state={rowIsSelected(row) ? 'selected' : undefined}
                  onClick={(event) => handleRowClick(event, row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'z-0',
                        cell.column.columnDef.meta?.sticky === 'right' && [STICKY_RIGHT, columnsHidden && STICKY_EDGE],
                        cell.column.columnDef.meta?.sticky === 'right' && isRowActive?.(row.original) && STICKY_ACTIVE,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export type { DataTableProps, ColumnDef, SortingState, VisibilityState }
