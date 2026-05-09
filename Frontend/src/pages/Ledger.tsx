import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiBarChartLine, RiCalendarLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Loading from '@/components/common/Loading'
import { ledgerApi } from '@/api/ledger.api'
import { formatCurrency, formatDate } from '@/utils/formatters'

const Ledger = () => {
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | '90'>('30')
  const [transactionType, setTransactionType] = useState<string>('')

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['ledger-summary'],
    queryFn: () => ledgerApi.getSummary(),
  })

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['ledger-transactions', transactionType],
    queryFn: () => ledgerApi.getTransactions(transactionType || undefined),
  })

  const daysParam = dateRange === 'all' ? 365 : parseInt(dateRange)
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['ledger-daily', dateRange],
    queryFn: () => ledgerApi.getDailySummary(daysParam),
  })

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['ledger-balance'],
    queryFn: () => ledgerApi.getBalance(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ledger</h1>
          <p className="text-muted-foreground mt-1">Financial transaction records and account balances</p>
        </div>
      </div>

      {!summaryLoading && summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <RiBarChartLine className="w-8 h-8 text-brand-600 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
              <p className="text-2xl font-bold text-foreground">{summaryData.total_count || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <RiBarChartLine className="w-8 h-8 text-success-600 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summaryData.total_amount || 0)}</p>
            </CardContent>
          </Card>
          {summaryData.by_type &&
            Object.entries(summaryData.by_type).slice(0, 2).map(([type, data]: any) => (
              <Card key={type}>
                <CardContent className="pt-6">
                  <RiBarChartLine className="w-8 h-8 text-brand-500 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">{type}</p>
                  <p className="text-2xl font-bold text-foreground">{data.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(data.total_amount)}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {balanceLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference Type</TableHead>
                  <TableHead>Total Debit</TableHead>
                  <TableHead>Total Credit</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balanceData || []).map((account: any) => (
                  <TableRow key={account._id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{account._id || 'Unknown'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-success-600 font-medium">{formatCurrency(account.total_debit)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-error-600 font-medium">{formatCurrency(account.total_credit)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${account.balance >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                        {formatCurrency(account.balance)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Activity</CardTitle>
            <div className="flex items-center gap-2">
              <RiCalendarLine className="w-4 h-4 text-muted-foreground" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="text-sm border border-border rounded px-2 py-1 bg-background"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dailyLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction Count</TableHead>
                  <TableHead>Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dailyData || []).slice(0, 30).map((day: any) => (
                  <TableRow key={day._id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{day._id}</span>
                    </TableCell>
                    <TableCell>{day.count}</TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(day.total_amount)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions</CardTitle>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="text-sm border border-border rounded px-2 py-1 bg-background"
            >
              <option value="">All Types</option>
              <option value="SALE">Sales</option>
              <option value="PURCHASE">Purchase</option>
              <option value="CUSTOMER_PAYMENT">Customer Payment</option>
              <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
              <option value="REFUND">Refund</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transactionsLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transactionsData?.data || []).slice(0, 50).map((tx: any) => (
                  <TableRow key={tx.transaction_id || tx._id}>
                    <TableCell>
                      <span className="text-sm">{formatDate(tx.created_at, 'MMM dd, yyyy')}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block px-2 py-1 rounded text-sm font-medium bg-brand-100 text-brand-700">
                        {tx.transaction_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{tx.reference_type}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(tx.amount)}</span>
                    </TableCell>
                    <TableCell>{tx.currency || 'USD'}</TableCell>
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

export default Ledger
