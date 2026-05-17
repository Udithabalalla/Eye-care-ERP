import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  RiBarChart2Line,
  RiMoneyDollarCircleLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiArrowRightSLine,
  RiReceiptLine,
  RiCalendarLine,
  RiWallet3Line,
  RiBarChartLine,
  RiFileTextLine,
  RiTimeLine,
  RiExternalLinkLine,
  RiUserLine,
} from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Loading from '@/components/common/Loading'
import { ledgerApi } from '@/api/ledger.api'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { LedgerReferenceType } from '@/types/erp.types'

const TX_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
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

function TypeBadge({ type }: { type: string }) {
  const cfg = TX_TYPE_CONFIG[type] ?? { label: type, color: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function TxDetailSheet({ tx, open, onClose }: { tx: any; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  if (!tx) return null
  const isCredit = ['SALE', 'CUSTOMER_PAYMENT'].includes(tx.transaction_type)
  const route = tx.reference_type ? REF_ROUTE[tx.reference_type as LedgerReferenceType] : undefined

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCredit ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-rose-100 dark:bg-rose-950/50'}`}>
              {isCredit
                ? <RiArrowDownLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                : <RiArrowUpLine className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
            </div>
            <div>
              <SheetTitle className="text-base leading-tight">Transaction Detail</SheetTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[220px]">
                {tx.transaction_id || tx._id}
              </p>
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
            {tx.currency && <p className="text-xs text-muted-foreground mt-1">{tx.currency}</p>}
          </div>

          <div className="space-y-3">
            <DetailRow icon={<RiReceiptLine className="h-4 w-4" />} label="Type">
              <TypeBadge type={tx.transaction_type} />
            </DetailRow>
            {tx.reference_type && (
              <>
                <Separator />
                <DetailRow icon={<RiFileTextLine className="h-4 w-4" />} label="Reference">
                  <div className="text-right">
                    <p className="text-sm font-medium">{tx.reference_type?.replace(/_/g, ' ')}</p>
                    {tx.reference_id && <p className="text-xs text-muted-foreground font-mono">{tx.reference_id}</p>}
                  </div>
                </DetailRow>
              </>
            )}
            {tx.payment_method && (
              <>
                <Separator />
                <DetailRow icon={<RiMoneyDollarCircleLine className="h-4 w-4" />} label="Payment Method">
                  <Badge variant="outline" className="capitalize">{tx.payment_method}</Badge>
                </DetailRow>
              </>
            )}
            <Separator />
            <DetailRow icon={<RiTimeLine className="h-4 w-4" />} label="Date">
              <span className="text-sm">{formatDate(tx.created_at)}</span>
            </DetailRow>
            {tx.created_by && (
              <>
                <Separator />
                <DetailRow icon={<RiUserLine className="h-4 w-4" />} label="Created By">
                  <span className="text-sm">{tx.created_by}</span>
                </DetailRow>
              </>
            )}
            {tx.status && (
              <>
                <Separator />
                <DetailRow icon={<RiTimeLine className="h-4 w-4" />} label="Status">
                  <Badge variant="outline" className="capitalize">{tx.status}</Badge>
                </DetailRow>
              </>
            )}
          </div>
        </div>

        {route && (
          <div className="px-6 pb-6 pt-4 border-t border-border/60">
            <Button className="w-full gap-2" onClick={() => { onClose(); navigate(route) }}>
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

const Ledger = () => {
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | '365'>('30')
  const [transactionType, setTransactionType] = useState<string>('')
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['ledger-summary'],
    queryFn: () => ledgerApi.getSummary(),
  })

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['ledger-transactions', transactionType],
    queryFn: () => ledgerApi.getTransactions(transactionType || undefined),
  })

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['ledger-daily', dateRange],
    queryFn: () => ledgerApi.getDailySummary(parseInt(dateRange)),
  })

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['ledger-balance'],
    queryFn: () => ledgerApi.getBalance(),
  })

  function openDetail(tx: any) {
    setSelectedTx(tx)
    setSheetOpen(true)
  }

  const txList = transactionsData?.data || []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ledger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Financial records, account balances, and daily activity. Click any row for details.</p>
      </div>

      {/* Summary KPI cards */}
      {summaryLoading ? (
        <div className="h-24 flex items-center justify-center"><Loading /></div>
      ) : summaryData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transactions</p>
                <RiBarChart2Line className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{summaryData.total_count ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Volume</p>
                <RiMoneyDollarCircleLine className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(summaryData.total_amount ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          {summaryData.by_type && Object.entries(summaryData.by_type).slice(0, 2).map(([type, d]: any) => (
            <Card key={type} className="border-border/60">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{TX_TYPE_CONFIG[type]?.label ?? type}</p>
                  <RiBarChartLine className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{d.count}</p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">{formatCurrency(d.total_amount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main tabbed content */}
      <Tabs defaultValue="transactions">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex mb-2">
          <TabsTrigger value="transactions" className="gap-2">
            <RiReceiptLine className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-2">
            <RiWallet3Line className="h-4 w-4" />
            Balances
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-2">
            <RiCalendarLine className="h-4 w-4" />
            Daily Activity
          </TabsTrigger>
        </TabsList>

        {/* ── Transactions tab ── */}
        <TabsContent value="transactions">
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Click a row to view full details and navigate to the source record</CardDescription>
                </div>
                <Select value={transactionType || 'all'} onValueChange={(v) => setTransactionType(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 w-full sm:w-48">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(TX_TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {transactionsLoading ? (
                <div className="p-10 flex justify-center"><Loading /></div>
              ) : txList.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <RiReceiptLine className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No transactions found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right pr-6">Amount</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txList.slice(0, 100).map((tx: any) => {
                        const isCredit = ['SALE', 'CUSTOMER_PAYMENT'].includes(tx.transaction_type)
                        return (
                          <TableRow
                            key={tx.transaction_id || tx._id}
                            className="cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => openDetail(tx)}
                          >
                            <TableCell className="pl-6">
                              <div>
                                <p className="text-sm font-medium">{formatDate(tx.created_at, 'MMM dd, yyyy')}</p>
                                {(tx.transaction_id || tx._id) && (
                                  <p className="text-xs text-muted-foreground font-mono">{(tx.transaction_id || tx._id).toString().slice(0, 10)}…</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell><TypeBadge type={tx.transaction_type} /></TableCell>
                            <TableCell>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tx.reference_type?.replace(/_/g, ' ')}</p>
                              {tx.reference_id && <p className="text-xs font-mono text-foreground/70 truncate max-w-[120px]">{tx.reference_id}</p>}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <span className={`tabular-nums font-semibold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                                {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
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
        </TabsContent>

        {/* ── Balances tab ── */}
        <TabsContent value="balances">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
              <CardDescription>Debit vs credit summary by reference type</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {balanceLoading ? (
                <div className="p-10 flex justify-center"><Loading /></div>
              ) : !balanceData?.length ? (
                <div className="py-16 text-center text-muted-foreground">
                  <RiWallet3Line className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No balance data available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Account Type</TableHead>
                        <TableHead className="text-right">Total Debit</TableHead>
                        <TableHead className="text-right">Total Credit</TableHead>
                        <TableHead className="text-right pr-6">Net Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(balanceData || []).map((account: any) => {
                        const isPositive = account.balance >= 0
                        return (
                          <TableRow key={account._id} className="hover:bg-muted/30">
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="font-medium text-sm">{account._id || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="tabular-nums text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                {formatCurrency(account.total_debit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="tabular-nums text-sm text-rose-600 dark:text-rose-400 font-medium">
                                {formatCurrency(account.total_credit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <span className={`tabular-nums font-bold text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isPositive ? '+' : ''}{formatCurrency(account.balance)}
                              </span>
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
        </TabsContent>

        {/* ── Daily Activity tab ── */}
        <TabsContent value="daily">
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Daily Activity</CardTitle>
                  <CardDescription>Transaction volume by day</CardDescription>
                </div>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                  <SelectTrigger className="h-9 w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {dailyLoading ? (
                <div className="p-10 flex justify-center"><Loading /></div>
              ) : !dailyData?.length ? (
                <div className="py-16 text-center text-muted-foreground">
                  <RiCalendarLine className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No activity data for this period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead className="text-center">Transactions</TableHead>
                        <TableHead className="text-right pr-6">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dailyData || []).slice(0, 60).map((day: any, idx: number) => {
                        const maxAmount = Math.max(...(dailyData || []).map((d: any) => d.total_amount || 0))
                        const barWidth = maxAmount > 0 ? Math.round((day.total_amount / maxAmount) * 100) : 0
                        return (
                          <TableRow key={day._id || idx} className="hover:bg-muted/30">
                            <TableCell className="pl-6">
                              <span className="text-sm font-medium">{day._id}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="tabular-nums">{day.count}</Badge>
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="flex items-center justify-end gap-3">
                                <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                                </div>
                                <span className="tabular-nums font-medium text-sm text-right min-w-[80px]">
                                  {formatCurrency(day.total_amount)}
                                </span>
                              </div>
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
        </TabsContent>
      </Tabs>

      <TxDetailSheet tx={selectedTx} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

export default Ledger
