import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  RiCalendarLine,
  RiMoneyDollarCircleLine,
  RiFileTextLine,
  RiTeamLine,
  RiUserAddLine,
  RiWallet3Line,
  RiBarChartLine,
  RiLayout4Line,
} from "@remixicon/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { dashboardApi } from "@/api/dashboard.api"
import { formatCurrency } from "@/utils/formatters"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const orderMixChartConfig = {
  sales_orders: {
    label: "Sales Orders",
    color: "var(--chart-1)",
  },
  invoices: {
    label: "Invoices",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const visitsChartConfig = {
  visits: {
    label: "Visits",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const financialChartConfig = {
  revenue: {
    label: "Total Revenue",
    color: "var(--chart-1)",
  },
  paid: {
    label: "Paid",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const Dashboard = () => {
  const navigate = useNavigate()

  const [widgets, setWidgets] = React.useState({
    kpiCards: true,
    weeklyRevenue: true,
    performanceNotes: true,
    orderMix: true,
    visitsThisWeek: true,
    financialSnapshot: true,
    operationsSnapshot: true,
    actionQueue: true,
  })

  const toggleWidget = (key: keyof typeof widgets) =>
    setWidgets((prev) => ({ ...prev, [key]: !prev[key] }))

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.getStats(),
  })

  const { data: orderTypes } = useQuery({
    queryKey: ["dashboard-order-types"],
    queryFn: () => dashboardApi.getOrderTypesSummary(),
  })

  const { data: appointmentsSummary } = useQuery({
    queryKey: ["dashboard-appointments-summary"],
    queryFn: () => dashboardApi.getAppointmentsSummary(),
  })

  const { data: revenueData } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: () => dashboardApi.getRevenue({}),
  })

  // Shape order mix chart data: one bar group per order type
  const orderMixData = [
    {
      type: "Full Order",
      sales_orders: orderTypes?.sales_orders?.FULL_ORDER ?? 0,
      invoices: orderTypes?.invoices?.FULL_ORDER ?? 0,
    },
    {
      type: "Partial Order",
      sales_orders: orderTypes?.sales_orders?.PARTIAL_ORDER ?? 0,
      invoices: orderTypes?.invoices?.PARTIAL_ORDER ?? 0,
    },
  ]

  // Shape visits chart from week summary
  const visitsData = (appointmentsSummary?.week_summary ?? []).map(
    (d: { date: string; count: number }) => ({
      day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
      visits: d.count,
    })
  )

  // Shape financial chart — last 14 days for readability
  const financialData = (revenueData?.daily_revenue ?? [])
    .slice(-14)
    .map((d: { date: string; revenue: number; paid: number }) => ({
      date: new Date(d.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      revenue: d.revenue,
      paid: d.paid,
    }))

  const overviewStats = [
    {
      title: "Total Patients",
      value: stats?.total_patients || 0,
      chip: "Active",
      tone: "secondary",
      icon: RiTeamLine,
    },
    {
      title: "Today's Appointments",
      value: stats?.today_appointments || 0,
      chip: "Scheduled",
      tone: "secondary",
      icon: RiCalendarLine,
    },
    {
      title: "Revenue This Month",
      value: formatCurrency(stats?.revenue_month || 0),
      chip: "Up 12%",
      tone: "secondary",
      icon: RiMoneyDollarCircleLine,
    },
    {
      title: "Pending Payments",
      value: formatCurrency(stats?.pending_payments || 0),
      chip: "Follow-up",
      tone: "destructive",
      icon: RiWallet3Line,
    },
  ]

  const revenueTrend = [
    { day: "Mon", revenue: 2400 },
    { day: "Tue", revenue: 1398 },
    { day: "Wed", revenue: 9800 },
    { day: "Thu", revenue: 3908 },
    { day: "Fri", revenue: 4800 },
    { day: "Sat", revenue: 3800 },
    { day: "Sun", revenue: 4300 },
  ]

  const performanceNotes = [
    { title: "Peak Hours", description: "Most appointments between 2-4 PM" },
    { title: "Top Product", description: "Contact lenses leading in sales" },
    { title: "Stock Alert", description: "3 items below minimum threshold" },
  ]

  const operationsData = [
    {
      item: "Appointments",
      value: stats?.total_appointments || 0,
      status: "Tracking",
    },
    {
      item: "Low Stock Items",
      value: stats?.low_stock_items || 0,
      status: "Needs Action",
    },
    {
      item: "Pending Payments",
      value: formatCurrency(stats?.pending_payments || 0),
      status: "Follow-up",
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back! Here's your practice overview.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <RiLayout4Line className="mr-2 h-4 w-4" />
                Customize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Widgets</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={widgets.kpiCards}
                  onCheckedChange={() => toggleWidget("kpiCards")}
                >
                  KPI Cards
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.weeklyRevenue}
                  onCheckedChange={() => toggleWidget("weeklyRevenue")}
                >
                  Weekly Revenue
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.performanceNotes}
                  onCheckedChange={() => toggleWidget("performanceNotes")}
                >
                  Performance Notes
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.orderMix}
                  onCheckedChange={() => toggleWidget("orderMix")}
                >
                  Order Mix
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.visitsThisWeek}
                  onCheckedChange={() => toggleWidget("visitsThisWeek")}
                >
                  Visits This Week
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.financialSnapshot}
                  onCheckedChange={() => toggleWidget("financialSnapshot")}
                >
                  Financial Snapshot
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.operationsSnapshot}
                  onCheckedChange={() => toggleWidget("operationsSnapshot")}
                >
                  Operations Snapshot
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={widgets.actionQueue}
                  onCheckedChange={() => toggleWidget("actionQueue")}
                >
                  Action Queue
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => navigate("/appointments")}
          >
            <RiCalendarLine className="mr-2 h-4 w-4" />
            View Schedule
          </Button>
          <Button onClick={() => navigate("/patients")}>
            <RiUserAddLine className="mr-2 h-4 w-4" />
            New Patient
          </Button>
        </div>
      </div>

      {widgets.kpiCards && <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((item) => (
          <Card key={item.title} className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{item.title}</CardDescription>
                <item.icon className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <CardTitle className="text-2xl">{item.value}</CardTitle>
              <Badge variant={item.tone as "secondary" | "destructive"}>
                {item.chip}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>}

      {(widgets.weeklyRevenue || widgets.performanceNotes) && <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {widgets.weeklyRevenue && <Card className="border-border/60 xl:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Weekly Revenue Trend</CardTitle>
            <CardDescription>
              Projection from current monthly performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueTrend}
                margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                  }}
                  formatter={(value) => [formatCurrency(value as number), ""]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>}

        {widgets.performanceNotes && <Card className="border-border/60 xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Performance Notes</CardTitle>
            <CardDescription>Key insights from your practice.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              {performanceNotes.map((note) => (
                <FieldSet key={note.title} className="gap-2">
                  <FieldLegend variant="label">{note.title}</FieldLegend>
                  <p className="text-sm text-muted-foreground">
                    {note.description}
                  </p>
                </FieldSet>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>}
      </section>}

      {/* Order Mix & Visits */}
      {(widgets.orderMix || widgets.visitsThisWeek) && <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {widgets.orderMix && <Card className="border-border/60 xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Order Mix</CardTitle>
            <CardDescription>
              Full vs partial orders — sales orders and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={orderMixChartConfig} className="h-[240px] w-full">
              <BarChart accessibilityLayer data={orderMixData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="type"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="sales_orders" fill="var(--color-sales_orders)" radius={4} />
                <Bar dataKey="invoices" fill="var(--color-invoices)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="flex gap-2 leading-none font-medium">
              Order breakdown by type
              <RiBarChartLine className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Comparing full and partial order volumes
            </div>
          </CardFooter>
        </Card>}

        {widgets.visitsThisWeek && <Card className="border-border/60 xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Visits This Week</CardTitle>
            <CardDescription>Daily appointment count</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={visitsChartConfig} className="h-[240px] w-full">
              <BarChart accessibilityLayer data={visitsData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="visits" fill="var(--color-visits)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="flex gap-2 leading-none font-medium">
              {appointmentsSummary?.upcoming_count ?? 0} upcoming in next 7 days
              <RiCalendarLine className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Current week · {appointmentsSummary?.today_count ?? 0} today
            </div>
          </CardFooter>
        </Card>}
      </section>}

      {/* Financial Snapshot */}
      {widgets.financialSnapshot && <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="border-border/60 xl:col-span-12">
          <CardHeader>
            <CardTitle className="text-base">Financial Snapshot</CardTitle>
            <CardDescription>
              Revenue vs paid — last 14 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={financialChartConfig} className="h-[260px] w-full">
              <BarChart accessibilityLayer data={financialData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                <Bar dataKey="paid" fill="var(--color-paid)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="flex gap-2 leading-none font-medium">
              Total this period:{" "}
              {formatCurrency(revenueData?.summary?.total_revenue ?? 0)}
              <RiMoneyDollarCircleLine className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Paid: {formatCurrency(revenueData?.summary?.total_paid ?? 0)} ·
              Pending: {formatCurrency(revenueData?.summary?.total_pending ?? 0)}
            </div>
          </CardFooter>
        </Card>
      </section>}

      {(widgets.operationsSnapshot || widgets.actionQueue) && <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {widgets.operationsSnapshot && <Card className="border-border/60 xl:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Operations Snapshot</CardTitle>
            <CardDescription>Current status of your operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operationsData.map((row) => (
                  <TableRow key={row.item}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RiFileTextLine className="size-3.5 text-muted-foreground" />
                        <span>{row.item}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "Needs Action"
                            ? "destructive"
                            : row.status === "Follow-up"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>}

        {widgets.actionQueue && <Card className="border-border/60 xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Action Queue</CardTitle>
            <CardDescription>Fast links for today's priorities.</CardDescription>
          </CardHeader>
          <CardContent className="h-full">
            <FieldGroup className="gap-2">
              <FieldSet className="gap-2">
                <FieldLegend variant="label" className="sr-only">
                  Dashboard quick actions
                </FieldLegend>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/inventory-movements")}
                >
                  Review inventory movements
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/payments")}
                >
                  Follow pending payments
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/appointments")}
                >
                  Confirm today appointments
                </Button>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>}
      </section>}
    </div>
  )
}

export default Dashboard
