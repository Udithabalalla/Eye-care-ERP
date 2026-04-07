import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { TableCard, Table, Input } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierInvoice } from '@/types/supplier.types'
import SupplierInvoiceForm from '@/components/suppliers/SupplierInvoiceForm'

const SupplierInvoices = () => {
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['supplier-invoices', search], queryFn: () => suppliersApi.getSupplierInvoices({ page: 1, page_size: 100 }) })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header title="Supplier Invoices" badge={data?.total || 0} description="Track supplier bills and due dates" contentTrailing={(
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Input placeholder="Search invoices..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
            <CommonButton onClick={() => { setSelectedInvoice(null); setIsFormOpen(true) }}><Plus className="w-4 h-4 mr-2" />Add Invoice</CommonButton>
          </div>
        )} />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Invoice #" isRowHeader />
              <Table.Head label="Supplier" />
              <Table.Head label="Status" />
              <Table.Head label="Amount" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((invoice) => (
                <Table.Row key={invoice.id}>
                  <Table.Cell>{invoice.invoice_number}</Table.Cell>
                  <Table.Cell>{invoice.supplier_id}</Table.Cell>
                  <Table.Cell>{invoice.status}</Table.Cell>
                  <Table.Cell>{invoice.total_amount.toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <CommonButton variant="outline" size="sm" onClick={() => { setSelectedInvoice(invoice); setIsFormOpen(true) }}>Edit</CommonButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
      {isFormOpen && <SupplierInvoiceForm invoice={selectedInvoice} onSuccess={() => { setSelectedInvoice(null); setIsFormOpen(false); refetch() }} onCancel={() => setIsFormOpen(false)} />}
    </div>
  )
}

export default SupplierInvoices
