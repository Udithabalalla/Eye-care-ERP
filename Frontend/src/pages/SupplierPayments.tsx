import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, SearchLg } from '@untitledui/icons'
import { TableCard, Table, Input } from '@/components/ui'
import Loading from '@/components/common/Loading'
import CommonButton from '@/components/common/Button'
import { suppliersApi } from '@/api/suppliers.api'
import { SupplierPayment } from '@/types/supplier.types'
import SupplierPaymentForm from '@/components/suppliers/SupplierPaymentForm'

const SupplierPayments = () => {
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['supplier-payments', search], queryFn: () => suppliersApi.getSupplierPayments({ page: 1, page_size: 100 }) })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header title="Supplier Payments" badge={data?.total || 0} description="Record and review supplier payments" contentTrailing={(
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Input placeholder="Search payments..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
            <CommonButton onClick={() => { setSelectedPayment(null); setIsFormOpen(true) }}><Plus className="w-4 h-4 mr-2" />Record Payment</CommonButton>
          </div>
        )} />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table>
            <Table.Header>
              <Table.Head label="Payment ID" isRowHeader />
              <Table.Head label="Invoice" />
              <Table.Head label="Method" />
              <Table.Head label="Amount" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {(data?.data || []).map((payment) => (
                <Table.Row key={payment.id}>
                  <Table.Cell>{payment.id}</Table.Cell>
                  <Table.Cell>{payment.invoice_id}</Table.Cell>
                  <Table.Cell>{payment.payment_method}</Table.Cell>
                  <Table.Cell>{payment.amount_paid.toFixed(2)}</Table.Cell>
                  <Table.Cell>
                    <CommonButton variant="outline" size="sm" onClick={() => setSelectedPayment(payment)}>View</CommonButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
      {isFormOpen && <SupplierPaymentForm payment={selectedPayment} onSuccess={() => { setSelectedPayment(null); setIsFormOpen(false); refetch() }} onCancel={() => setIsFormOpen(false)} />}
    </div>
  )
}

export default SupplierPayments
