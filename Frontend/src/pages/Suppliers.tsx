import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { Supplier } from '@/types/supplier.types'
import SupplierForm from '@/components/suppliers/SupplierForm'

const Suppliers = () => {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100, search }),
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Suppliers"
          badge={data?.total || 0}
          description="Manage suppliers for procurement"
          contentTrailing={(
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input placeholder="Search suppliers..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <CommonButton onClick={() => { setSelectedSupplier(null); setIsOpen(true) }}><Plus className="w-4 h-4 mr-2" />Add Supplier</CommonButton>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Supplier" isRowHeader />
              <Table.Head label="Contact" />
              <Table.Head label="Email" />
              <Table.Head label="Payment Terms" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((supplier) => (
                <Table.Row key={supplier.id}>
                  <Table.Cell>{supplier.supplier_name}</Table.Cell>
                  <Table.Cell>{supplier.phone || supplier.contact_person || '-'}</Table.Cell>
                  <Table.Cell>{supplier.email || '-'}</Table.Cell>
                  <Table.Cell>{supplier.payment_terms || '-'}</Table.Cell>
                  <Table.Cell>
                    <CommonButton variant="outline" size="sm" onClick={() => { setSelectedSupplier(supplier); setIsOpen(true) }}>Edit</CommonButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
      {isOpen && <SupplierForm supplier={selectedSupplier} onSuccess={() => { setIsOpen(false); refetch() }} onCancel={() => setIsOpen(false)} />}
    </div>
  )
}

export default Suppliers
