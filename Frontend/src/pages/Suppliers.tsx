import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiMore2Line,
  RiReceiptLine,
  RiTruckLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier } from '@/types/supplier.types'
import SupplierForm from '@/components/suppliers/SupplierForm'
import { DataTable, type RowAction } from '@/components/data-table'
import Pagination from '@/components/common/Pagination'

const Suppliers = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  const sortBy = sorting[0]?.id
  const sortOrder = sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suppliers', page, pageSize, search, sortBy, sortOrder],
    queryFn: () =>
      suppliersApi.getAll({ page, page_size: pageSize, search, sort_by: sortBy, sort_order: sortOrder }),
  })

  const suppliers = data?.data || []

  const isAllSelected =
    suppliers.length > 0 && suppliers.every((s) => selectedSupplierIds.includes(s.id))
  const isIndeterminate =
    selectedSupplierIds.some((id) => suppliers.some((s) => s.id === id)) && !isAllSelected

  const selectedRows = useMemo(
    () => suppliers.filter((s) => selectedSupplierIds.includes(s.id)),
    [suppliers, selectedSupplierIds],
  )

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      toast.success('Supplier deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setSupplierToDelete(null)
      setSelectedSupplierIds((current) =>
        current.filter((id) => id !== supplierToDelete?.id),
      )
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete supplier')
    },
  })

  const handleSortingChange = (updaterOrValue: Updater<SortingState>) => {
    setSorting((current) => {
      const next =
        typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      setPage(1)
      return next
    })
  }

  const toggleAll = (isSelected: boolean) => {
    const visibleIds = suppliers.map((s) => s.id)
    if (isSelected) {
      setSelectedSupplierIds((current) => Array.from(new Set([...current, ...visibleIds])))
    } else {
      setSelectedSupplierIds((current) => current.filter((id) => !visibleIds.includes(id)))
    }
  }

  const toggleOne = (id: string, isSelected: boolean) => {
    setSelectedSupplierIds((current) =>
      isSelected ? [...current, id] : current.filter((v) => v !== id),
    )
  }

  const openEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setIsFormOpen(true)
  }

  const rowActions: RowAction<Supplier>[] = [
    {
      id: 'edit',
      label: 'Edit Supplier',
      icon: RiEditLine,
      onClick: (rows) => openEdit(rows[0]),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'purchase-orders',
      label: 'View Purchase Orders',
      icon: RiTruckLine,
      onClick: (rows) => navigate(`/purchase-orders?supplier_id=${rows[0].id}`),
      showWhen: 'single',
      primary: true,
    },
    {
      id: 'invoices',
      label: 'View Invoices',
      icon: RiReceiptLine,
      onClick: (rows) => navigate(`/supplier-invoices?supplier_id=${rows[0].id}`),
      showWhen: 'single',
    },
    {
      id: 'delete',
      label: 'Delete Supplier',
      icon: RiDeleteBin6Line,
      onClick: (rows) => setSupplierToDelete(rows[0]),
      showWhen: 'single',
    },
  ]

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all suppliers"
            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.supplier_name}`}
            checked={selectedSupplierIds.includes(row.original.id)}
            onCheckedChange={(checked) => toggleOne(row.original.id, checked === true)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'supplier_name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Supplier{' '}
            {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </Button>
        ),
        cell: ({ row }) => {
          const name = row.original.supplier_name
          const initials = name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{name}</p>
                {row.original.company_name && (
                  <p className="truncate text-sm text-muted-foreground">
                    {row.original.company_name}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'contact',
        header: 'Contact',
        enableSorting: false,
        cell: ({ row }) => {
          const { contact_person, phone } = row.original
          return (
            <div className="min-w-0">
              {contact_person && (
                <p className="truncate text-sm font-medium text-foreground">{contact_person}</p>
              )}
              {phone && (
                <p className="truncate text-sm text-muted-foreground">{phone}</p>
              )}
              {!contact_person && !phone && (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) =>
          row.original.email ? (
            <span className="text-sm">{row.original.email}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'payment_terms',
        header: 'Payment Terms',
        cell: ({ row }) =>
          row.original.payment_terms ? (
            <Badge variant="outline">{row.original.payment_terms}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
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
                aria-label="Open supplier actions"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <RiEditLine className="size-4" />
                Edit Supplier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/purchase-orders?supplier_id=${row.original.id}`)}
              >
                <RiTruckLine className="size-4" />
                View Purchase Orders
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/supplier-invoices?supplier_id=${row.original.id}`)}
              >
                <RiReceiptLine className="size-4" />
                View Invoices
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSupplierToDelete(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <RiDeleteBin6Line className="size-4" />
                Delete Supplier
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isAllSelected, isIndeterminate, selectedSupplierIds],
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers for procurement.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => {
            setSelectedSupplier(null)
            setIsFormOpen(true)
          }}
        >
          <RiAddLine className="size-4" />
          Add Supplier
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Supplier Records</CardTitle>
              <CardDescription>Search and manage all suppliers.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <div className="w-full md:w-auto md:self-end">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
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
            data={suppliers}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            loading={isLoading}
            searchPlaceholder="Search suppliers..."
            className="px-6"
            emptyMessage="No suppliers found."
            selectedRows={selectedRows}
            rowActions={rowActions}
            onRowClick={(row) => toggleOne(row.id, !selectedSupplierIds.includes(row.id))}
            onClearSelection={() => setSelectedSupplierIds([])}
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

      {isFormOpen && (
        <SupplierForm
          supplier={selectedSupplier}
          onSuccess={() => {
            setIsFormOpen(false)
            refetch()
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <AlertDialog
        open={!!supplierToDelete}
        onOpenChange={(open) => {
          if (!open) setSupplierToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{' '}
              <span className="font-medium text-foreground">
                {supplierToDelete?.supplier_name}
              </span>{' '}
              from the system. Existing purchase orders and invoices linked to this supplier will
              remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSupplierToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                supplierToDelete && deleteSupplierMutation.mutate(supplierToDelete.id)
              }
              disabled={deleteSupplierMutation.isPending}
            >
              {deleteSupplierMutation.isPending ? 'Deleting…' : 'Delete Supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Suppliers
