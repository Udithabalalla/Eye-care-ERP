import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, SearchLg } from '@untitledui/icons'
import SalesOrderIntakeForm from '@/components/sales-orders/SalesOrderIntakeForm'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrder, SalesOrderStatus } from '@/types/erp.types'
import { BadgeWithDot, Button, Input, PaginationPageDefault, Select, SelectItem, Table, TableCard } from '@/components/ui'
import Loading from '@/components/common/Loading'
import { formatCurrency, formatDate } from '@/utils/formatters'

const statusColors: Record<SalesOrderStatus, 'success' | 'warning' | 'error' | 'gray'> = {
  draft: 'gray',
  confirmed: 'warning',
  in_production: 'warning',
  ready: 'success',
  completed: 'success',
  cancelled: 'error',
}

const statusOptions: Array<{ id: SalesOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All Statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const SalesOrders = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [showIntake, setShowIntake] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, pageSize, statusFilter],
    queryFn: () =>
      salesOrdersApi.getAll({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
      }),
  })

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const baseRows = data?.data || []
    if (!query) return baseRows

    return baseRows.filter((order) =>
      [
        order.order_number,
        order.patient_name,
        order.patient_id,
        order.prescription_id,
        order.tested_by,
        order.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [data, search])

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Sales Orders"
          badge={data?.total || 0}
          description="View all created sales orders and launch the intake workflow"
          contentTrailing={(
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Input
                placeholder="Search order #, patient, status..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                className="w-full sm:w-72"
              />
              <Select
                selectedKey={statusFilter || 'all'}
                onSelectionChange={(key) => {
                  setStatusFilter(key === 'all' ? '' : (String(key) as SalesOrderStatus))
                  setPage(1)
                }}
                placeholder="Status"
                className="w-full sm:w-40"
              >
                {statusOptions.map((status) => (
                  <SelectItem key={status.id} id={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </Select>
              <Select
                selectedKey={String(pageSize)}
                onSelectionChange={(key) => {
                  setPageSize(Number(key))
                  setPage(1)
                }}
                placeholder="Rows"
                className="w-full sm:w-28"
              >
                <SelectItem id="10">10 rows</SelectItem>
                <SelectItem id="25">25 rows</SelectItem>
                <SelectItem id="50">50 rows</SelectItem>
              </Select>
              <Button onClick={() => setShowIntake((current) => !current)} iconLeading={Plus} size="sm">
                {showIntake ? 'Hide Intake' : 'New Sales Order'}
              </Button>
            </div>
          )}
        />

        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table aria-label="Sales orders table">
              <Table.Header>
                <Table.Head label="Order #" isRowHeader />
                <Table.Head label="Patient" />
                <Table.Head label="Status" />
                <Table.Head label="Items" />
                <Table.Head label="Total" />
                <Table.Head label="Delivery" />
                <Table.Head label="Created" />
                <Table.Head label="Invoice" />
              </Table.Header>
              <Table.Body items={rows as SalesOrder[]}>
                {(order) => (
                  <Table.Row id={order.order_id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-medium text-primary">{order.order_number}</span>
                        <span className="text-xs text-tertiary">{order.order_id}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="text-primary">{order.patient_name || order.patient_id}</span>
                        <span className="text-xs text-tertiary">{order.patient_id}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <BadgeWithDot size="sm" color={statusColors[order.status]}>
                        {order.status.replace('_', ' ')}
                      </BadgeWithDot>
                    </Table.Cell>
                    <Table.Cell>{order.items.length}</Table.Cell>
                    <Table.Cell>{formatCurrency(order.total_amount || order.subtotal || 0)}</Table.Cell>
                    <Table.Cell>{order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '-'}</Table.Cell>
                    <Table.Cell>{formatDate(order.created_at)}</Table.Cell>
                    <Table.Cell>
                      {order.invoice_id ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/invoices?detail=${order.invoice_id}`)}
                        >
                          View Invoice
                        </Button>
                      ) : (
                        <span className="text-xs text-tertiary">Not generated</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>

            {data && data.total_pages > 1 && (
              <PaginationPageDefault
                page={page}
                total={data.total_pages}
                onPageChange={setPage}
                className="border-t border-secondary px-6 py-4"
              />
            )}
          </>
        )}
      </TableCard.Root>

      {showIntake && <SalesOrderIntakeForm />}
    </div>
  )
}

export default SalesOrders
