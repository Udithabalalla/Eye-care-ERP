import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { Plus } from '@untitledui/icons'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier } from '@/types/supplier.types'
import SupplierForm from '@/components/suppliers/SupplierForm'
import { DataTable } from '@/components/data-table'

const Suppliers = () => {
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const sortBy = sorting[0]?.id
  const sortOrder = sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suppliers', search, sortBy, sortOrder],
    queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100, search, sort_by: sortBy, sort_order: sortOrder }),
  })

  const handleSortingChange = (updaterOrValue: Updater<SortingState>) => {
    setSorting((current) => (typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue))
  }

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: 'supplier_name',
        header: ({ column }) => (
          <CommonButton variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Supplier {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </CommonButton>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => row.original.phone || row.original.contact_person || '-',
        enableSorting: false,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <CommonButton variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Email {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </CommonButton>
        ),
        cell: ({ row }) => row.original.email || '-',
      },
      {
        accessorKey: 'payment_terms',
        header: ({ column }) => (
          <CommonButton variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Payment Terms {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
          </CommonButton>
        ),
        cell: ({ row }) => row.original.payment_terms || '-',
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <CommonButton
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedSupplier(row.original)
              setIsOpen(true)
            }}
          >
            Edit
          </CommonButton>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Suppliers</CardTitle>
              <CardDescription>Manage suppliers for procurement.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <Badge variant="secondary" className="w-fit">
                {data?.total || 0} total
              </Badge>
              <CommonButton
                onClick={() => {
                  setSelectedSupplier(null)
                  setIsOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add Supplier
              </CommonButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            columns={columns}
            data={data?.data || []}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={setSearch}
            loading={isLoading}
            searchPlaceholder="Search suppliers..."
          />
        </CardContent>
      </Card>
      {isOpen && <SupplierForm supplier={selectedSupplier} onSuccess={() => { setIsOpen(false); refetch() }} onCancel={() => setIsOpen(false)} />}
    </div>
  )
}

export default Suppliers
