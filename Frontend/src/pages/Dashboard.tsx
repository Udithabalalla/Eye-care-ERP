import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  DollarSign,
  FileBarChart,
  FileText,
  Package,
  TrendingUp,
  Users,
  UserRoundPlus,
  WalletCards,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardApi } from '@/api/dashboard.api'
import { formatCurrency } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FieldGroup, FieldSet, FieldLegend } from '@/components/ui/field'

const Dashboard = () => {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    )
  }

  const overviewStats = [
    {
      title: "Today's Appointments",
      value: String(stats?.today_appointments || 0),
      icon: CalendarDays,
      tone: 'secondary',
      chip: 'Today',
    },
    {
      title: 'Low Stock Items',
      value: String(stats?.low_stock_items || 0),
      icon: Package,
      tone: 'destructive',
      chip: 'Stock',
    },
    {
      title: 'Total Patients',
      value: String(stats?.total_patients || 0),
      icon: Users,
      tone: 'default',
      chip: 'Active',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(stats?.pending_payments || 0),
      icon: WalletCards,
      tone: 'outline',
      chip: 'Pending',
    },
  ] as const

  const revenueBaseline = Number(stats?.revenue_month || 0)
  const revenueTrend = [
    { day: 'Mon', value: Math.round(revenueBaseline * 0.11) },
    { day: 'Tue', value: Math.round(revenueBaseline * 0.13) },
    { day: 'Wed', value: Math.round(revenueBaseline * 0.14) },
    { day: 'Thu', value: Math.round(revenueBaseline * 0.17) },
    { day: 'Fri', value: Math.round(revenueBaseline * 0.19) },
    { day: 'Sat', value: Math.round(revenueBaseline * 0.15) },
    { day: 'Sun', value: Math.round(revenueBaseline * 0.11) },
  ]

  const opsRows = [
    {
      item: 'Appointments',
      value: Number(stats?.today_appointments || 0),
      status: 'Tracking',
    },
    {
      item: 'Low Stock Items',
      value: Number(stats?.low_stock_items || 0),
      status: Number(stats?.low_stock_items || 0) > 0 ? 'Needs Action' : 'Healthy',
    },
    {
      item: 'Pending Payments',
      value: Number(stats?.pending_payments || 0),
      status: Number(stats?.pending_payments || 0) > 0 ? 'Follow-up' : 'Clear',
    },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your practice performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/appointments')}>
            View schedule
          </Button>
          <Button onClick={() => navigate('/patients')}>
            <UserRoundPlus className="size-4" />
            New patient
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-border/60 lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.2),transparent_45%),radial-gradient(circle_at_85%_10%,hsl(var(--accent)/0.16),transparent_35%)]" />
          <CardHeader className="relative">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              Revenue this month
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(stats?.revenue_month || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative flex flex-wrap items-center justify-between gap-3">
            <Badge variant="secondary">+12.5% from last month</Badge>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/invoices')}>New invoice</Button>
              <Button variant="outline" onClick={() => navigate('/reports')}>
                <FileBarChart className="size-4" />
                Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Revenue today</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(stats?.revenue_today || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Badge variant="outline">Live</Badge>
            <DollarSign className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>{item.title}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <CardTitle className="text-2xl">{item.value}</CardTitle>
                <Badge variant={item.tone}>{item.chip}</Badge>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="border-border/60 xl:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Weekly Revenue Trend</CardTitle>
            <CardDescription>Projection from current monthly performance.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--card)',
                    color: 'var(--card-foreground)',
                  }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Performance Notes</CardTitle>
            <CardDescription>Suggested actions based on live metrics.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="font-medium text-foreground">Revenue pacing is healthy</p>
              <p className="text-muted-foreground">Keep invoicing cadence for remaining week days.</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="font-medium text-foreground">Appointments remain steady</p>
              <p className="text-muted-foreground">Consider extending slots for peak hours this Friday.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 xl:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Operations Snapshot</CardTitle>
            <CardDescription>Key items to review today.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opsRows.map((row) => (
                  <TableRow key={row.item}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-muted-foreground" />
                        <span>{row.item}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'Needs Action' ? 'destructive' : row.status === 'Follow-up' ? 'outline' : 'secondary'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.item === 'Pending Payments' ? formatCurrency(row.value) : row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/60 xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Action Queue</CardTitle>
            <CardDescription>Fast links for today’s priorities.</CardDescription>
          </CardHeader>
          <CardContent className="h-full">
            <FieldGroup className="gap-2">
              <FieldSet className="gap-2">
                <FieldLegend variant="label" className="sr-only">Dashboard quick actions</FieldLegend>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/inventory-movements')}>
                  Review inventory movements
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/payments')}>
                  Follow pending payments
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/appointments')}>
                  Confirm today appointments
                </Button>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default Dashboard
