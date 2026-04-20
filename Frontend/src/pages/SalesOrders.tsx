import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, SearchLg } from '@untitledui/icons'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrderStatus } from '@/types/erp.types'
import { BadgeWithDot, Button, Input, PaginationPageDefault, Select, SelectItem } from '@/components/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-2xl">Sales Orders</CardTitle>
              <CardDescription className="mt-1">View all created sales orders and open the sales order assistant</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              <Button onClick={() => navigate('/sales-orders/assistant')} iconLeading={Plus} size="sm">
                New Sales Order
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Order #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((order) => (
                      <TableRow key={order.order_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{order.order_number}</span>
                            <span className="text-xs text-muted-foreground">{order.order_id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-foreground">{order.patient_name || order.patient_id}</span>
                            <span className="text-xs text-muted-foreground">{order.patient_id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BadgeWithDot size="sm" color={statusColors[order.status]}>
                            {order.status.replace('_', ' ')}
                          </BadgeWithDot>
                        </TableCell>
                        <TableCell>{order.items.length}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount || order.subtotal || 0)}</TableCell>
                        <TableCell>{order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '-'}</TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          {order.invoice_id ? (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/invoices?detail=${order.invoice_id}`)}
                            >
                              View Invoice
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not generated</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data && data.total_pages > 1 && (
                <PaginationPageDefault
                  page={page}
                  total={data.total_pages}
                  onPageChange={setPage}
                  className="border-t border-border px-6 py-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesOrders

