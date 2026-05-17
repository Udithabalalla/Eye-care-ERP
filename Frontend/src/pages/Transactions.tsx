import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  RiSearchLine,
  RiArrowRightSLine,
  RiMoneyDollarCircleLine,
  RiReceiptLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiFilterLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiUserLine,
  RiFileTextLine,
} from '@remixicon/react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
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

const TYPE_CONFIG: Record<LedgerTransactionType, { label: string; color: string }> = {
  SALE:             { label: 'Sale',             color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
  PURCHASE:         { label: 'Purchase',         color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' },
  SUPPLIER_PAYMENT: { label: 'Supplier Payment', color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800' },
  CUSTOMER_PAYMENT: { label: 'Customer Payment', color: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800' },
  REFUND:           { label: 'Refund',           color: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800' },
}

const REF_ROUTE: Partial<Record<LedgerReferenceType, string>> = {
  INVOICE:          '/invoices',
  SALES_ORDER:      '/sales-orders',
  PURCHASE_ORDER:   '/purchase-orders',
  SUPPLIER_INVOICE: '/supplier-invoices',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', upi: 'UPI',
  netbanking: 'Net Banking', 'bank-transfer': 'Bank Transfer', insurance: 'Insurance',
}

function TypeBadge({ type }: { type: LedgerTransactionType }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function TransactionDetailSheet({ tx, open, onClose }: { tx: Transaction | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  if (!tx) return null
  const route = tx.reference_type ? REF_ROUTE[tx.reference_type] : undefined
  const isCredit = ['SALE', 'CUSTOMER_PAYMENT'].includes(tx.transaction_type)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCredit ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-rose-100 dark:bg-rose-950/50'}`}>
                {isCredit
                  ? <RiArrowDownLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  : <RiArrowUpLine className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
              </div>
              <div>
                <SheetTitle className="text-base leading-tight">Transaction Detail</SheetTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[220px]">{tx.transaction_id}</p>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Amount hero */}
          <div className={`rounded-xl p-4 text-center ${isCredit ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{isCredit ? 'Credit' : 'Debit'}</p>
            <p className={`text-3xl font-bold tabular-nums ${isCredit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {formatCurrency(tx.amount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{tx.currency}</p>
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            <DetailRow icon={<RiReceiptLine className="h-4 w-4" />} label="Type">
              <TypeBadge type={tx.transaction_type} />
            </DetailRow>
            <Separator />
            <DetailRow icon={<RiFileTextLine className="h-4 w-4" />} label="Reference">
              <div className="text-right">
                <p className="text-sm font-medium">{tx.reference_type}</p>
                <p className="text-xs text-muted-foreground font-mono">{tx.reference_id}</p>
              </div>
            </DetailRow>
            {tx.payment_method && (
              <>
                <Separator />
                <DetailRow icon={<RiMoneyDollarCircleLine className="h-4 w-4" />} label="Payment Method">
                  <span className="text-sm font-medium">{METHOD_LABELS[tx.payment_method] ?? tx.payment_method}</span>
                </DetailRow>
              </>
            )}
            <Separator />
            <DetailRow icon={<RiTimeLine className="h-4 w-4" />} label="Date">
              <span className="text-sm">{formatDate(tx.created_at)}</span>
            </DetailRow>
            <Separator />
            <DetailRow icon={<RiUserLine className="h-4 w-4" />} label="Created By">
              <span className="text-sm">{tx.created_by}</span>
            </DetailRow>
            <Separator />
            <DetailRow icon={<RiTimeLine className="h-4 w-4" />} label="Status">
              <Badge variant="outline" className="capitalize">{tx.status}</Badge>
            </DetailRow>
          </div>
        </div>

        {route && (
          <div className="px-6 pb-6 pt-4 border-t border-border/60">
            <Button
              className="w-full gap-2"
              onClick={() => { onClose(); navigate(route) }}
            >
              <RiExternalLinkLine className="h-4 w-4" />
              View {tx.reference_type?.replace(/_/g, ' ')} Record
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {children}
    </div>
  )
}

const Transactions = () => {
  const [transactionType, setTransactionType] = useState<LedgerTransactionType | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceType, setReferenceType] = useState<LedgerReferenceType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const hasFilters = !!(transactionType || paymentMethod || referenceType || startDate || endDate || search)

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

  const allRows = data?.data || []
  const rows = allRows.filter((tx) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [tx.transaction_id, tx.reference_id, tx.created_by].join(' ').toLowerCase().includes(q)
  })

  // KPI aggregates
  const totalAmount = rows.reduce((s, t) => s + (t.amount || 0), 0)
  const creditTotal = rows.filter((t) => ['SALE', 'CUSTOMER_PAYMENT'].includes(t.transaction_type)).reduce((s, t) => s + t.amount, 0)
  const debitTotal  = rows.filter((t) => !['SALE', 'CUSTOMER_PAYMENT'].includes(t.transaction_type)).reduce((s, t) => s + t.amount, 0)

  function clearFilters() {
    setTransactionType('')
    setPaymentMethod('')
    setReferenceType('')
    setStartDate('')
    setEndDate('')
    setSearch('')
  }

  function openDetail(tx: Transaction) {
    setSelectedTx(tx)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transaction Explorer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Trace every financial event across the ERP. Click any row for details.</p>
      </div>

      {/* KPI strip */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Volume</p>
                <RiMoneyDollarCircleLine className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">{rows.length} transactions</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Money In</p>
                <RiArrowDownLine className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(creditTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Sales &amp; customer payments</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Money Out</p>
                <RiArrowUpLine className="h-4 w-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(debitTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Purchases, payments &amp; refunds</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main table card */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transaction Records</CardTitle>
              <CardDescription>Filter and explore all financial transactions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground h-8">
                  <RiCloseLine className="h-3.5 w-3.5" />
                  Clear filters
                </Button>
              )}
              <Badge variant="secondary">{rows.length} records</Badge>
            </div>
          </div>

          {/* Filter bar */}
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search ID or user…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={transactionType || 'all'} onValueChange={(v) => setTransactionType(v === 'all' ? '' : v as LedgerTransactionType)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {transactionTypes.map((t) => <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentMethod || 'all'} onValueChange={(v) => setPaymentMethod(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All Methods" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m] ?? m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={referenceType || 'all'} onValueChange={(v) => setReferenceType(v === 'all' ? '' : v as LedgerReferenceType)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All References" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                {referenceTypes.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" className="h-9 flex-1" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" className="h-9 flex-1" />
            </div>
          </div>

          {hasFilters && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <RiFilterLine className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {transactionType && <Badge variant="outline" className="text-xs h-5">{TYPE_CONFIG[transactionType as LedgerTransactionType]?.label}</Badge>}
              {referenceType && <Badge variant="outline" className="text-xs h-5">{referenceType.replace(/_/g, ' ')}</Badge>}
              {paymentMethod && <Badge variant="outline" className="text-xs h-5">{METHOD_LABELS[paymentMethod] ?? paymentMethod}</Badge>}
              {startDate && <Badge variant="outline" className="text-xs h-5">From {startDate}</Badge>}
              {endDate && <Badge variant="outline" className="text-xs h-5">To {endDate}</Badge>}
              {search && <Badge variant="outline" className="text-xs h-5">"{search}"</Badge>}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-10 flex justify-center"><Loading /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <RiReceiptLine className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No transactions match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-8 pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((tx: Transaction) => {
                    const isCredit = ['SALE', 'CUSTOMER_PAYMENT'].includes(tx.transaction_type)
                    return (
                      <TableRow
                        key={tx.transaction_id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => openDetail(tx)}
                      >
                        <TableCell className="pl-6">
                          <div>
                            <p className="text-sm font-medium">{formatDate(tx.created_at)}</p>
                            <p className="text-xs text-muted-foreground font-mono">{tx.transaction_id.slice(0, 12)}…</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={tx.transaction_type} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tx.reference_type?.replace(/_/g, ' ')}</p>
                            <p className="text-xs font-mono text-foreground/70 truncate max-w-[140px]">{tx.reference_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {tx.payment_method
                            ? <Badge variant="outline" className="text-xs capitalize">{METHOD_LABELS[tx.payment_method] ?? tx.payment_method}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`tabular-nums font-semibold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                            {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4">
                          <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailSheet tx={selectedTx} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

export default Transactions
