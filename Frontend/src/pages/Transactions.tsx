import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RiBarChartLine } from '@remixicon/react'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loading from '@/components/common/Loading'
import { transactionsApi } from '@/api/erp.api'
import { LedgerReferenceType, LedgerTransactionType, Transaction } from '@/types/erp.types'
import { formatDate, formatCurrency } from '@/utils/formatters'

const transactionTypes: LedgerTransactionType[] = [
  'SALE',
  'PURCHASE',
  'SUPPLIER_PAYMENT',
  'CUSTOMER_PAYMENT',
  'REFUND',
]
const referenceTypes: LedgerReferenceType[] = [
  'INVOICE',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'SUPPLIER_INVOICE',
  'STOCK_ADJUSTMENT',
]
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
    queryFn: () =>
      transactionsApi.getAll({
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
    return [transaction.transaction_id, transaction.reference_id, transaction.created_by]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Transaction Explorer
          </h1>
          <p className="text-sm text-muted-foreground">
            Trace every financial event across the ERP.
          </p>
        </div>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Transaction Records</CardTitle>
              <CardDescription>Filter and explore all financial transactions.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {rows.length} total
            </Badge>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <RiBarChartLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={transactionType || 'all'}
              onValueChange={(val) =>
                setTransactionType(val === 'all' ? '' : (val as LedgerTransactionType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {transactionTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentMethod || 'all'}
              onValueChange={(val) => setPaymentMethod(val === 'all' ? '' : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={referenceType || 'all'}
              onValueChange={(val) =>
                setReferenceType(val === 'all' ? '' : (val as LedgerReferenceType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Reference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                {referenceTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((transaction: Transaction) => (
                    <TableRow key={transaction.transaction_id}>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.transaction_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {transaction.reference_type} / {transaction.reference_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell>{transaction.payment_method || '-'}</TableCell>
                      <TableCell>{transaction.created_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Transactions
