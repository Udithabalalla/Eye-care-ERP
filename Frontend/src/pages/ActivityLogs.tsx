import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input } from '@/components/ui'
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
      <TableCard.Root>
        <TableCard.Header
          title="Activity Logs"
          badge={rows.length}
          description="Audit trail for business actions"
          contentTrailing={(
            <Input placeholder="Search logs..." value={search} onChange={setSearch} iconLeading={SearchLg} className="w-full sm:w-72" />
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Audit logs table">
            <Table.Header>
              <Table.Head label="Timestamp" isRowHeader />
              <Table.Head label="Action" />
              <Table.Head label="Entity" />
              <Table.Head label="Entity ID" />
              <Table.Head label="User" />
            </Table.Header>
            <Table.Body items={rows as AuditLog[]}>
              {(log) => (
                <Table.Row id={log.log_id}>
                  <Table.Cell>{formatDate(log.timestamp, 'MMM dd, yyyy HH:mm')}</Table.Cell>
                  <Table.Cell>{log.action}</Table.Cell>
                  <Table.Cell>{log.entity_type}</Table.Cell>
                  <Table.Cell>{log.entity_id}</Table.Cell>
                  <Table.Cell>{log.user_id}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
    </div>
  )
}

export default ActivityLogs