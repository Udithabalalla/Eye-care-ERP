import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Loading from '@/components/common/Loading'
import { auditLogsApi } from '@/api/erp.api'
import { AuditLog } from '@/types/erp.types'
import { formatDate } from '@/utils/formatters'

const ActivityLogs = () => {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditLogsApi.getAll({ page: 1, page_size: 100 }),
  })

  const rows = (data?.data || []).filter((log) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [log.log_id, log.action, log.entity_type, log.entity_id, log.user_id].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Activity Logs</CardTitle>
              <Badge variant="secondary">{rows.length}</Badge>
            </div>
            <CardDescription>Audit trail for business actions</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log: AuditLog) => (
                  <TableRow key={log.log_id}>
                    <TableCell>{formatDate(log.timestamp, 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell>{log.entity_id}</TableCell>
                    <TableCell>{log.user_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ActivityLogs
