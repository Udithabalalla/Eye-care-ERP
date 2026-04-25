import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { RiAddLine, RiSearchLine } from '@remixicon/react'
import { salesOrdersApi } from '@/api/erp.api'
import { SalesOrderStatus } from '@/types/erp.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Loading from '@/components/common/Loading'
import { formatCurrency, formatDate } from '@/utils/formatters'

const statusVariant: Record<SalesOrderStatus, 'secondary' | 'outline' | 'destructive' | 'default'> = {
  draft: 'outline',
  confirmed: 'secondary',
  in_production: 'secondary',
  ready: 'default',
  completed: 'default',
  cancelled: 'destructive',
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
      [order.order_number, order.patient_name, order.patient_id, order.prescription_id, order.tested_by, order.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [data, search])

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-2xl">Sales Orders</CardTitle>
              <CardDescription className="mt-1">
                View all created sales orders and open the sales order assistant
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search order #, patient, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-full sm:w-72"
                />
              </div>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => {
                  setStatusFilter(value === 'all' ? '' : (value as SalesOrderStatus))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => navigate('/sales-orders/assistant')}>
                <RiAddLine className="size-4" />
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
                          <Badge variant={statusVariant[order.status]} className="capitalize">
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.items.length}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount || order.subtotal || 0)}</TableCell>
                        <TableCell>
                          {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '-'}
                        </TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          {order.invoice_id ? (
                            <Button
                              size="sm"
                              variant="outline"
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
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No sales orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {data && data.total_pages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === data.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesOrders
