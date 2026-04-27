import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Transaction Explorer</CardTitle>
              <Badge variant="secondary">{rows.length}</Badge>
            </div>
            <CardDescription>Trace every financial event across the ERP</CardDescription>
          </div>
          <div className="grid w-full gap-3 lg:grid-cols-5">
            <div className="relative lg:col-span-1">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={transactionType || 'all'}
              onValueChange={(val) => setTransactionType(val === 'all' ? '' : val as LedgerTransactionType)}
            >
              <SelectTrigger className="lg:col-span-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {transactionTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={paymentMethod || 'all'}
              onValueChange={(val) => setPaymentMethod(val === 'all' ? '' : val)}
            >
              <SelectTrigger className="lg:col-span-1">
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={referenceType || 'all'}
              onValueChange={(val) => setReferenceType(val === 'all' ? '' : val as LedgerReferenceType)}
            >
              <SelectTrigger className="lg:col-span-1">
                <SelectValue placeholder="Reference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                {referenceTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 lg:col-span-1">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground" />
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8"><Loading /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((transaction: Transaction) => (
                  <TableRow key={transaction.transaction_id}>
                    <TableCell>{formatDate(transaction.created_at)}</TableCell>
                    <TableCell>{transaction.transaction_type}</TableCell>
                    <TableCell>{transaction.reference_type} / {transaction.reference_id}</TableCell>
                    <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                    <TableCell>{transaction.payment_method || '-'}</TableCell>
                    <TableCell>{transaction.created_by}</TableCell>
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

export default Transactions
