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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Ledger</h1>
          <p className="mt-1 text-[17px] text-secondary">Financial transaction records and account balances</p>
        </div>
      </div>

      {/* Summary Cards */}
      {!summaryLoading && summaryData && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="card bg-bg-primary ring-1 ring-border">
            <BarChart07 className="mb-3 h-8 w-8 text-brand-600" />
            <p className="mb-1 text-sm text-tertiary">Total Transactions</p>
            <p className="text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-primary">{summaryData.total_count || 0}</p>
          </div>
          <div className="card bg-bg-primary ring-1 ring-border">
            <BarChart07 className="mb-3 h-8 w-8 text-success-600" />
            <p className="mb-1 text-sm text-tertiary">Total Amount</p>
            <p className="text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-primary">{formatCurrency(summaryData.total_amount || 0)}</p>
          </div>
          {summaryData.by_type &&
            Object.entries(summaryData.by_type).slice(0, 2).map(([type, data]: any) => (
              <div key={type} className="card bg-bg-primary ring-1 ring-border">
                <BarChart07 className="mb-3 h-8 w-8 text-brand-500" />
                <p className="mb-1 text-sm text-tertiary">{type}</p>
                <p className="text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-primary">{data.count}</p>
                <p className="text-xs text-secondary">{formatCurrency(data.total_amount)}</p>
              </div>
            ))}
        </div>
      )}

      {/* Account Balance Table */}
      <div className="card bg-bg-primary ring-1 ring-border">
        <h2 className="mb-4 text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Account Balances</h2>
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
                    <span className="font-medium text-primary">{account._id || 'Unknown'}</span>
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
      <div className="card bg-bg-primary ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Daily Activity</h2>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-secondary" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="rounded-apple border border-border bg-bg-primary px-2 py-1 text-sm text-primary"
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
                    <span className="font-medium text-primary">{day._id}</span>
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
      <div className="card bg-bg-primary ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Recent Transactions</h2>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="rounded-apple border border-border bg-bg-primary px-2 py-1 text-sm text-primary"
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
                    <span className="inline-block rounded-apple px-2 py-1 text-sm font-medium bg-brand-50 text-brand-700">
                      {tx.transaction_type}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-secondary">{tx.reference_type}</span>
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