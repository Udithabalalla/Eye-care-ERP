import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem } from '@/components/ui'
import Loading from '@/components/common/Loading'
import { paymentsApi } from '@/api/erp.api'
import { LedgerReferenceType, Payment } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'

const Payments = () => {
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['payments', referenceType],
    queryFn: () => paymentsApi.getAll({ page: 1, page_size: 100, reference_type: referenceType || undefined }),
  })

  const rows = (data?.data || []).filter((payment) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [payment.payment_id, payment.reference_id, payment.created_by].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Payments"
          badge={rows.length}
          description="Unified customer and supplier payments"
          contentTrailing={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search payments..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <Select selectedKey={referenceType || 'all'} onSelectionChange={(key) => setReferenceType(key === 'all' ? '' : String(key) as LedgerReferenceType)} placeholder="Reference Type">
                <SelectItem id="all">All References</SelectItem>
                <SelectItem id="INVOICE">Invoice</SelectItem>
                <SelectItem id="SALES_ORDER">Sales Order</SelectItem>
                <SelectItem id="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem id="SUPPLIER_INVOICE">Supplier Invoice</SelectItem>
              </Select>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Payments table">
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Payment ID" />
              <Table.Head label="Reference" />
              <Table.Head label="Amount" />
              <Table.Head label="Method" />
              <Table.Head label="Transaction" />
            </Table.Header>
            <Table.Body items={rows as Payment[]}>
              {(payment) => (
                <Table.Row id={payment.payment_id}>
                  <Table.Cell>{formatDate(payment.payment_date)}</Table.Cell>
                  <Table.Cell>{payment.payment_id}</Table.Cell>
                  <Table.Cell>{payment.reference_type} / {payment.reference_id}</Table.Cell>
                  <Table.Cell>{formatCurrency(payment.amount)}</Table.Cell>
                  <Table.Cell>{payment.payment_method}</Table.Cell>
                  <Table.Cell>{payment.transaction_id || '-'}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
    </div>
  )
}

export default Payments