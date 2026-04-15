import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem } from '@/components/ui'
import Loading from '@/components/common/Loading'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrderStatus } from '@/types/erp.types'
import { formatDate } from '@/utils/formatters'

const statusOptions: Array<{ id: string; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const SalesOrders = () => {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SalesOrderStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', search, status],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 100, status: status || undefined }),
  })

  const rows = (data?.data || []).filter((order) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [order.order_number, order.patient_id, order.prescription_id || '']
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Sales Orders"
          badge={rows.length}
          description="Track customer commitments before billing"
          contentTrailing={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input placeholder="Search sales orders..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
              <Select selectedKey={status || 'all'} onSelectionChange={(key) => setStatus(key === 'all' ? '' : String(key) as SalesOrderStatus)} placeholder="Status">
                <SelectItem id="all">All Statuses</SelectItem>
                {statusOptions.map((option) => <SelectItem key={option.id} id={option.id}>{option.label}</SelectItem>)}
              </Select>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Sales orders table">
            <Table.Header>
              <Table.Head label="Order #" isRowHeader />
              <Table.Head label="Patient" />
              <Table.Head label="Prescription" />
              <Table.Head label="Status" />
              <Table.Head label="Created" />
            </Table.Header>
            <Table.Body items={rows}>
              {(order) => (
                <Table.Row id={order.order_id}>
                  <Table.Cell>{order.order_number}</Table.Cell>
                  <Table.Cell>{order.patient_id}</Table.Cell>
                  <Table.Cell>{order.prescription_id || '-'}</Table.Cell>
                  <Table.Cell>{order.status}</Table.Cell>
                  <Table.Cell>{formatDate(order.created_at)}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
    </div>
  )
}

export default SalesOrders