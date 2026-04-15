import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input, Select, SelectItem } from '@/components/ui'
import Loading from '@/components/common/Loading'
import { transactionsApi } from '@/api/erp.api'
import { LedgerReferenceType, LedgerTransactionType, Transaction } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'

const transactionTypes: LedgerTransactionType[] = ['SALE', 'PURCHASE', 'SUPPLIER_PAYMENT', 'CUSTOMER_PAYMENT', 'REFUND']
const referenceTypes: LedgerReferenceType[] = ['INVOICE', 'SALES_ORDER', 'PURCHASE_ORDER', 'SUPPLIER_INVOICE', 'STOCK_ADJUSTMENT']
const paymentMethods = ['cash', 'card', 'upi', 'netbanking', 'bank-transfer', 'insurance']

const Transactions = () => {
  const [transactionType, setTransactionType] = useState<LedgerTransactionType | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', transactionType, paymentMethod, referenceType, startDate, endDate],
    queryFn: () => transactionsApi.getAll({
      page: 1,
      page_size: 100,
      transaction_type: transactionType || undefined,
      payment_method: paymentMethod || undefined,
      reference_type: referenceType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
  })

  const rows = (data?.data || []).filter((transaction) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [transaction.transaction_id, transaction.reference_id, transaction.created_by].join(' ').toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Transaction Explorer"
          badge={rows.length}
          description="Trace every financial event across the ERP"
          contentTrailing={(
            <div className="grid w-full gap-3 lg:grid-cols-5">
              <Input placeholder="Search reference..." value={search} onChange={setSearch} iconLeading={SearchLg} className="lg:col-span-1" />
              <Select selectedKey={transactionType || 'all'} onSelectionChange={(key) => setTransactionType(key === 'all' ? '' : String(key) as LedgerTransactionType)} placeholder="Type" className="lg:col-span-1">
                <SelectItem id="all">All Types</SelectItem>
                {transactionTypes.map((type) => <SelectItem key={type} id={type}>{type}</SelectItem>)}
              </Select>
              <Select selectedKey={paymentMethod || 'all'} onSelectionChange={(key) => setPaymentMethod(key === 'all' ? '' : String(key))} placeholder="Payment Method" className="lg:col-span-1">
                <SelectItem id="all">All Methods</SelectItem>
                {paymentMethods.map((method) => <SelectItem key={method} id={method}>{method}</SelectItem>)}
              </Select>
              <Select selectedKey={referenceType || 'all'} onSelectionChange={(key) => setReferenceType(key === 'all' ? '' : String(key) as LedgerReferenceType)} placeholder="Reference" className="lg:col-span-1">
                <SelectItem id="all">All References</SelectItem>
                {referenceTypes.map((type) => <SelectItem key={type} id={type}>{type}</SelectItem>)}
              </Select>
              <div className="flex gap-2 lg:col-span-1">
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-primary px-3 text-sm text-primary" />
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-primary px-3 text-sm text-primary" />
              </div>
            </div>
          )}
        />
        {isLoading ? <div className="p-8"><Loading /></div> : (
          <Table aria-label="Transactions table">
            <Table.Header>
              <Table.Head label="Date" isRowHeader />
              <Table.Head label="Type" />
              <Table.Head label="Reference" />
              <Table.Head label="Amount" />
              <Table.Head label="Payment Method" />
              <Table.Head label="User" />
            </Table.Header>
            <Table.Body items={rows as Transaction[]}>
              {(transaction) => (
                <Table.Row id={transaction.transaction_id}>
                  <Table.Cell>{formatDate(transaction.created_at)}</Table.Cell>
                  <Table.Cell>{transaction.transaction_type}</Table.Cell>
                  <Table.Cell>{transaction.reference_type} / {transaction.reference_id}</Table.Cell>
                  <Table.Cell>{formatCurrency(transaction.amount)}</Table.Cell>
                  <Table.Cell>{transaction.payment_method || '-'}</Table.Cell>
                  <Table.Cell>{transaction.created_by}</Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>
    </div>
  )
}

export default Transactions