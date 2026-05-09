import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, type SortingState, type Updater } from '@tanstack/react-table'
import { RiAddLine, RiEditLine } from '@remixicon/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    queryFn: () =>
      suppliersApi.getAll({ page: 1, page_size: 100, search, sort_by: sortBy, sort_order: sortOrder }),
  })

  const handleSortingChange = (updaterOrValue: Updater<SortingState>) => {
    setSorting((current) =>
      typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue,
    )
  }

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: 'supplier_name',
        header: 'Supplier',
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.supplier_name}</span>
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
        header: 'Email',
        cell: ({ row }) => row.original.email || '-',
      },
      {
        accessorKey: 'payment_terms',
        header: 'Payment Terms',
        cell: ({ row }) => row.original.payment_terms || '-',
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedSupplier(row.original)
              setIsOpen(true)
            }}
          >
            <RiEditLine className="size-4" />
            Edit
          </Button>
        ),
      },
    ],
    [],
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
            setIsOpen(true)
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
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable
            columns={columns}
            data={data?.data || []}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={search}
            onGlobalFilterChange={setSearch}
            loading={isLoading}
            searchPlaceholder="Search suppliers..."
            className="px-6"
            emptyMessage="No suppliers found."
          />
        </CardContent>
      </Card>

      {isOpen && (
        <SupplierForm
          supplier={selectedSupplier}
          onSuccess={() => { setIsOpen(false); refetch() }}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default Suppliers
