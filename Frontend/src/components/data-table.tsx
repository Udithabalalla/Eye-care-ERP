import * as React from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { RiArrowDownSLine, RiCloseLine, RiMore2Line } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the generics must match TanStack's declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Keep the column in view at the table's right edge while the rest scrolls sideways (row actions) */
    sticky?: 'right'
  }
}

// A pinned cell sits over the scrolling ones, so it needs an opaque background that
// follows the row's hover / selected / open-in-drawer colours
const STICKY_RIGHT =
  'sticky right-0 z-[1] bg-card group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] group-data-[state=selected]/row:bg-muted'
// Edge shadow, only while columns are scrolled out of sight under the pinned one
const STICKY_EDGE = 'shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.2)]'
const STICKY_ACTIVE = 'bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]'

export type RowAction<TData> = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (rows: TData[]) => void
  /** 'single' = only when 1 row selected, 'multiple' = only when 2+, 'any' = always. Defaults to 'any'. */
  showWhen?: 'single' | 'multiple' | 'any'
  /** Show as a top-level button in the group (in addition to the dropdown). Defaults to false. */
  primary?: boolean
}

// The column's own header when it is plain text ("Order #"), else its id made readable
// ("expected_delivery_date" → "Expected delivery date")
const columnLabel = (id: string, header: unknown) => {
  if (typeof header === 'string' && header.trim()) return header
  const words = id.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

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
}: DataTableProps<TData, TValue>) {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const tableWrapRef = React.useRef<HTMLDivElement>(null)
  const [columnsHidden, setColumnsHidden] = React.useState(false)

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

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange,
    onGlobalFilterChange: (value) => onGlobalFilterChange(String(value ?? '')),
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
  })

  const rows = table.getRowModel().rows
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length
  const selectionCount = selectedRows?.length ?? 0

  const applicableActions = React.useMemo(() => {
    if (!rowActions || selectionCount === 0) return []
    return rowActions.filter((action) => {
      if (!action.showWhen || action.showWhen === 'any') return true
      if (action.showWhen === 'single') return selectionCount === 1
      if (action.showWhen === 'multiple') return selectionCount > 1
      return true
    })
  }, [rowActions, selectionCount])

  const primaryActions = applicableActions.filter((a) => a.primary)

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
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {selectionCount} selected
            </span>
            <ButtonGroup>
              {primaryActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    onClick={() => action.onClick(selectedRows!)}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {action.label}
                  </Button>
                )
              })}
              {applicableActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon-sm" aria-label="More actions">
                      <RiMore2Line className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {applicableActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={() => action.onClick(selectedRows!)}
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClearSelection}
                aria-label="Clear selection"
              >
                <RiCloseLine className="size-3.5" />
              </Button>
            )}
          </div>
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
                  {columnLabel(column.id, column.columnDef.header)}
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
                  data-state={(row.getIsSelected() || selectedRows?.includes(row.original)) ? 'selected' : undefined}
                  onClick={(e) => {
                    if (!onRowClick) return
                    const target = e.target as HTMLElement
                    if (
                      target.closest(
                        'button, a, input, [role="checkbox"], [role="menuitem"], [role="menu"]',
                      )
                    )
                      return
                    onRowClick(row.original)
                  }}
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

export type { DataTableProps, ColumnDef, SortingState }
