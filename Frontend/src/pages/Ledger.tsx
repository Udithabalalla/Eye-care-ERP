import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart07, Calendar } from '@untitledui/icons'
import { Table } from '@/components/ui'
import Loading from '@/components/common/Loading'
import { ledgerApi } from '@/api/ledger.api'
import { formatCurrency, formatDate } from '@/utils/formatters'

const Ledger = () => {
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | '90'>('30')
  const [transactionType, setTransactionType] = useState<string>('')

  // Get ledger summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['ledger-summary'],
    queryFn: () => ledgerApi.getSummary(),
  })

  // Get transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['ledger-transactions', transactionType],
    queryFn: () => ledgerApi.getTransactions(transactionType || undefined),
  })

  // Get daily summary
  const daysParam = dateRange === 'all' ? 365 : parseInt(dateRange)
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['ledger-daily', dateRange],
    queryFn: () => ledgerApi.getDailySummary(daysParam),
  })

  // Get account balance
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['ledger-balance'],
    queryFn: () => ledgerApi.getBalance(),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ledger</h1>
          <p className="text-muted-foreground mt-1">Financial transaction records and account balances</p>
        </div>
      </div>

      {/* Summary Cards */}
      {!summaryLoading && summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <BarChart07 className="w-8 h-8 text-brand-600 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-foreground">{summaryData.total_count || 0}</p>
          </div>
          <div className="card">
            <BarChart07 className="w-8 h-8 text-success-600 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(summaryData.total_amount || 0)}</p>
          </div>
          {summaryData.by_type &&
            Object.entries(summaryData.by_type).slice(0, 2).map(([type, data]: any) => (
              <div key={type} className="card">
                <BarChart07 className="w-8 h-8 text-brand-500 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">{type}</p>
                <p className="text-2xl font-bold text-foreground">{data.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data.total_amount)}</p>
              </div>
            ))}
        </div>
      )}

      {/* Account Balance Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-foreground mb-4">Account Balances</h2>
        {balanceLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Head label="Reference Type" isRowHeader />
              <Table.Head label="Total Debit" />
              <Table.Head label="Total Credit" />
              <Table.Head label="Balance" />
            </Table.Header>
            <Table.Body>
              {(balanceData || []).map((account: any) => (
                <Table.Row key={account._id}>
                  <Table.Cell>
                    <span className="font-medium text-foreground">{account._id || 'Unknown'}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-success-600 font-medium">{formatCurrency(account.total_debit)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-error-600 font-medium">{formatCurrency(account.total_credit)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`font-bold ${account.balance >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                      {formatCurrency(account.balance)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Daily Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Daily Activity</h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="text-sm border border-border rounded px-2 py-1"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        {dailyLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Transaction Count" />
              <Table.Head label="Total Amount" />
            </Table.Header>
            <Table.Body>
              {(dailyData || []).slice(0, 30).map((day: any) => (
                <Table.Row key={day._id}>
                  <Table.Cell>
                    <span className="font-medium text-foreground">{day._id}</span>
                  </Table.Cell>
                  <Table.Cell>{day.count}</Table.Cell>
                  <Table.Cell>
                    <span className="font-medium">{formatCurrency(day.total_amount)}</span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Transaction List */}
      <div className="card">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1"
          >
            <option value="">All Types</option>
            <option value="SALE">Sales</option>
            <option value="PURCHASE">Purchase</option>
            <option value="CUSTOMER_PAYMENT">Customer Payment</option>
            <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
            <option value="REFUND">Refund</option>
          </select>
        </div>
        {transactionsLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Type" />
              <Table.Head label="Reference" />
              <Table.Head label="Amount" />
              <Table.Head label="Currency" />
            </Table.Header>
            <Table.Body>
              {(transactionsData?.data || []).slice(0, 50).map((tx: any) => (
                <Table.Row key={tx.transaction_id || tx._id}>
                  <Table.Cell>
                    <span className="text-sm">{formatDate(tx.created_at, 'MMM dd, yyyy')}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="inline-block px-2 py-1 rounded text-sm font-medium bg-brand-100 text-brand-700">
                      {tx.transaction_type}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-muted-foreground">{tx.reference_type}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-medium">{formatCurrency(tx.amount)}</span>
                  </Table.Cell>
                  <Table.Cell>{tx.currency || 'USD'}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </div>
  )
}

export default Ledger
