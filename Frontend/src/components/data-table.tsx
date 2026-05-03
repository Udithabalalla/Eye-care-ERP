import * as React from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
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
}: DataTableProps<TData, TValue>) {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

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
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="z-0">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="z-0">
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
                  className={cn('z-0', onRowClick && 'cursor-pointer')}
                  data-state={row.getIsSelected() && 'selected'}
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
                    <TableCell key={cell.id} className="z-0">
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
