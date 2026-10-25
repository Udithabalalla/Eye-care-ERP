import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  RiAlertLine,
  RiArrowRightSLine,
  RiBankCardLine,
  RiCalendarLine,
  RiGlassesLine,
  RiLayout4Line,
  RiMoneyDollarCircleLine,
  RiPhoneLine,
  RiReceiptLine,
  RiShoppingCartLine,
  RiTruckLine,
  RiUserAddLine,
  RiWallet3Line,
} from '@remixicon/react'
import { dashboardApi, type DashboardOverview } from '@/api/dashboard.api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KpiTile, Delta } from '@/components/dashboard/KpiTile'
import { SalesTrendCard } from '@/components/dashboard/SalesTrendCard'
import { SalesMixCard } from '@/components/dashboard/SalesMixCard'
import PatientModal from '@/components/patients/PatientModal'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import { PatientAvatar } from '@/components/patients/PatientAvatar'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatters'

const WIDGETS = [
  ['kpis', 'Headline numbers'],
  ['sales', 'Sales trend'],
  ['today', 'Today'],
  ['workshop', 'In the workshop'],
  ['ready', 'Ready to collect'],
  ['selling', 'What’s selling'],
  ['stock', 'Stock to reorder'],
  ['buying', 'Buying'],
] as const
type WidgetKey = (typeof WIDGETS)[number][0]
const STORAGE_KEY = 'dashboard-widgets'

const STAGES: Record<DashboardOverview['pipeline'][number]['stage'], { label: string; status: string; hint: string }> = {
  new: { label: 'New', status: 'created', hint: 'Lens to order' },
  lens_ordered: { label: 'Lens ordered', status: 'lens_ordered', hint: 'Waiting on the lab' },
  fitting: { label: 'Fitting', status: 'fitting', hint: 'Being made up' },
  ready: { label: 'Ready', status: 'ready', hint: 'Waiting for the patient' },
}

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const loadWidgets = (): Record<WidgetKey, boolean> => {
  const all = Object.fromEntries(WIDGETS.map(([key]) => [key, true])) as Record<WidgetKey, boolean>
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...all, ...saved }
  } catch {
    return all
  }
}

/** Small titled card with an optional link in the header */
function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && (
          <Button variant="ghost" size="sm" className="-mr-2 h-7 shrink-0 gap-0.5 text-xs" onClick={action.onClick}>
            {action.label}
            <RiArrowRightSLine className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>
)

const Dashboard = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [widgets, setWidgets] = useState(loadWidgets)
  const [patientOpen, setPatientOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
    } catch {
      /* the layout just won't be remembered */
    }
  }, [widgets])

  // Refetches keep the last numbers on screen — no skeleton flash
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardApi.getOverview,
    refetchInterval: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const firstName = user?.name?.split(' ')[0]
  const show = (key: WidgetKey) => widgets[key]

  return (
    // The one accent every chart on the page draws with (brand teal; lighter step for dark)
    <div className="space-y-6 [--dash-accent:#007595] dark:[--dash-accent:#38a3c2]">
      {/* ── Header ── */}
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, d MMMM')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <RiLayout4Line className="size-4" />
                Customize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Show on the dashboard</DropdownMenuLabel>
              {WIDGETS.map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={widgets[key]}
                  onCheckedChange={(checked) => setWidgets((w) => ({ ...w, [key]: !!checked }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAppointmentOpen(true)}>
            <RiCalendarLine className="size-4" />
            Book appointment
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPatientOpen(true)}>
            <RiUserAddLine className="size-4" />
            New patient
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/sales-orders/assistant')}>
            <RiReceiptLine className="size-4" />
            New sales order
          </Button>
        </div>
      </section>

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className={cn('space-y-6 transition-opacity', isFetching && !isLoading && 'opacity-90')}>
          {/* ── Headline numbers ── */}
          {show('kpis') && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
              <KpiTile
                icon={RiReceiptLine}
                label="Sales today"
                value={formatCurrency(data.sales.today)}
                footer={<Delta now={data.sales.today} before={data.sales.yesterday} against="vs yesterday" noneBefore="No sales yesterday" />}
                onClick={() => navigate('/invoices')}
              />
              <KpiTile
                icon={RiMoneyDollarCircleLine}
                label="Sales this month"
                value={formatCurrency(data.sales.month)}
                footer={<Delta now={data.sales.month} before={data.sales.last_month_same_period} against="vs last month" noneBefore="No sales by this date last month" />}
              />
              <KpiTile
                icon={RiWallet3Line}
                label="Collected this month"
                value={formatCurrency(data.collected.month)}
                footer={<span className="text-xs text-muted-foreground">{formatCurrency(data.collected.today)} today</span>}
                onClick={() => navigate('/payments')}
              />
              <KpiTile
                icon={RiBankCardLine}
                label="To collect from patients"
                value={formatCurrency(data.receivables.total)}
                tone={data.receivables.total > 0 ? 'warn' : undefined}
                footer={
                  <span className="text-xs text-muted-foreground">
                    {data.receivables.count} invoice{data.receivables.count === 1 ? '' : 's'}
                    {data.receivables.overdue_count > 0 && (
                      <span className="font-medium text-red-600 dark:text-red-400"> · {data.receivables.overdue_count} overdue</span>
                    )}
                  </span>
                }
                onClick={() => navigate('/invoices')}
              />
              <KpiTile
                icon={RiTruckLine}
                label="Owed to suppliers"
                value={formatCurrency(data.payables.total)}
                footer={
                  <span className="text-xs text-muted-foreground">
                    {data.payables.overdue_count > 0 ? (
                      <span className="font-medium text-red-600 dark:text-red-400">{data.payables.overdue_count} overdue</span>
                    ) : (
                      `${data.payables.count} bill${data.payables.count === 1 ? '' : 's'} open`
                    )}
                    {data.payables.due_this_week > 0 && ` · ${formatCurrency(data.payables.due_this_week)} due this week`}
                  </span>
                }
                onClick={() => navigate(data.payables.overdue_count ? '/supplier-invoices?status=overdue' : '/supplier-invoices')}
              />
            </div>
          )}

          {/* ── Sales trend + today ── */}
          {(show('sales') || show('today')) && (
            <div className="grid gap-6 lg:grid-cols-3">
              {show('sales') && (
                <div className={cn(show('today') ? 'lg:col-span-2' : 'lg:col-span-3')}>
                  <SalesTrendCard daily={data.daily} today={data.date} />
                </div>
              )}
              {show('today') && (
                <Panel
                  title="Today"
                  description={`${data.appointments_today.length} appointment${data.appointments_today.length === 1 ? '' : 's'} · ${data.patients.new_this_month} new patient${data.patients.new_this_month === 1 ? '' : 's'} this month`}
                  action={{ label: 'Calendar', onClick: () => navigate('/appointments') }}
                  className={cn(!show('sales') && 'lg:col-span-3')}
                >
                  {data.appointments_today.length === 0 ? (
                    <div className="space-y-3">
                      <Empty>Nothing booked for today.</Empty>
                      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setAppointmentOpen(true)}>
                        <RiCalendarLine className="size-4" />
                        Book an appointment
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {data.appointments_today.map((appt) => (
                        <li key={appt.appointment_id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/patients?detail=${appt.patient_id}`)}
                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">{appt.time ?? '—'}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{appt.patient_name}</span>
                              <span className="block truncate text-xs capitalize text-muted-foreground">
                                {[appt.type?.replace(/-/g, ' '), appt.doctor_name && `Dr. ${appt.doctor_name}`].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs capitalize text-muted-foreground">{appt.status?.replace(/-/g, ' ')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          )}

          {/* ── Workshop · ready · selling ── */}
          {(show('workshop') || show('ready') || show('selling')) && (
            <div className="grid gap-6 lg:grid-cols-3">
              {show('workshop') && (
                <Panel
                  title="In the workshop"
                  description={`${data.pipeline.reduce((sum, s) => sum + s.count, 0)} orders on the way`}
                  action={{ label: 'Orders', onClick: () => navigate('/sales-orders') }}
                >
                  {/* Stages in order; each number opens that stage's orders */}
                  <ol className="space-y-2">
                    {data.pipeline.map((stage, index) => {
                      const info = STAGES[stage.stage]
                      const max = Math.max(...data.pipeline.map((s) => s.count), 1)
                      return (
                        <li key={stage.stage}>
                          <button
                            type="button"
                            onClick={() => navigate(`/sales-orders?status=${info.status}`)}
                            className="group w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <span className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
                                <span className="font-medium">{info.label}</span>
                                <span className="hidden text-xs text-muted-foreground sm:inline">{info.hint}</span>
                              </span>
                              <span className="font-semibold tabular-nums">{stage.count}</span>
                            </span>
                            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-[var(--dash-accent)] transition-all"
                                style={{ width: `${(stage.count / max) * 100}%` }}
                              />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </Panel>
              )}

              {show('ready') && (
                <Panel
                  title="Ready to collect"
                  description={data.ready_count ? `${data.ready_count} patient${data.ready_count === 1 ? '' : 's'} waiting for their glasses` : 'Nobody waiting'}
                  action={data.ready_count ? { label: 'All', onClick: () => navigate('/sales-orders?status=ready') } : undefined}
                >
                  {data.ready_for_collection.length === 0 ? (
                    <Empty>No glasses waiting to be collected.</Empty>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {data.ready_for_collection.map((order) => (
                        <li key={order.order_id} className="flex items-center gap-3 py-2">
                          <PatientAvatar name={order.patient_name || '?'} seed={order.patient_id} className="size-8 text-[11px]" />
                          <button type="button" onClick={() => navigate(`/sales-orders?detail=${order.order_id}`)} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-medium hover:text-primary">{order.patient_name ?? order.order_number}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {order.order_number}
                              {order.waiting_days != null && ` · ${order.waiting_days === 0 ? 'ready today' : `waiting ${order.waiting_days} day${order.waiting_days === 1 ? '' : 's'}`}`}
                            </span>
                          </button>
                          <span className="shrink-0 text-right">
                            {order.balance_due > 0 ? (
                              <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">{formatCurrency(order.balance_due)} due</span>
                            ) : (
                              <span className="block text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
                            )}
                            {order.phone && (
                              <a href={`tel:${order.phone}`} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                                <RiPhoneLine className="size-3" />
                                Call
                              </a>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              {show('selling') && <SalesMixCard mix={data.sales_mix} top={data.top_items} />}
            </div>
          )}

          {/* ── Stock · buying ── */}
          {(show('stock') || show('buying')) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {show('stock') && (
                <Panel
                  title="Stock to reorder"
                  description={
                    data.stock.low + data.stock.out === 0 ? 'Everything is above its reorder level' : (
                      <>
                        <span className={cn(data.stock.out > 0 && 'font-medium text-red-600 dark:text-red-400')}>{data.stock.out} out of stock</span>
                        {` · ${data.stock.low} running low`}
                      </>
                    )
                  }
                  action={data.stock.low + data.stock.out ? { label: 'Reorder', onClick: () => navigate('/inventory/reorder') } : undefined}
                >
                  {data.stock.items.length === 0 ? (
                    <Empty>Nothing needs reordering.</Empty>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {data.stock.items.map((item) => (
                        <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 py-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', item.out_of_stock ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400')}>
                              {item.kind === 'frame' ? <RiGlassesLine className="size-3.5" /> : <RiAlertLine className="size-3.5" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{item.name}</span>
                              {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs">
                            <span className={cn('block font-semibold', item.out_of_stock ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                              {item.out_of_stock ? 'Out of stock' : `${item.current_stock} left`}
                            </span>
                            <span className="text-muted-foreground">reorder at {item.reorder_level}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              {show('buying') && (
                <Panel title="Buying" description="Orders with suppliers that need you" action={{ label: 'Purchase orders', onClick: () => navigate('/purchase-orders') }}>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Awaiting delivery', value: data.purchasing.awaiting_delivery, hint: 'Ordered, not all here yet', to: '/purchase-orders?status=Ordered' },
                      { label: 'Waiting for their bill', value: data.purchasing.awaiting_invoice, hint: 'Received, no supplier invoice', to: '/purchase-orders?status=Received' },
                      { label: 'Supplier bills overdue', value: data.payables.overdue_count, hint: data.payables.overdue_total ? formatCurrency(data.payables.overdue_total) : 'None', to: '/supplier-invoices?status=overdue', warn: data.payables.overdue_count > 0 },
                      { label: 'Due this week', value: formatCurrency(data.payables.due_this_week), hint: 'To suppliers', to: '/supplier-invoices' },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={() => navigate(stat.to)}
                        className="rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                      >
                        <span className="block text-xs text-muted-foreground">{stat.label}</span>
                        <span className={cn('block text-lg font-semibold', stat.warn && 'text-red-600 dark:text-red-400')}>{stat.value}</span>
                        <span className="block truncate text-xs text-muted-foreground">{stat.hint}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => navigate('/purchase-orders/new')}>
                    <RiShoppingCartLine className="size-4" />
                    New purchase order
                  </Button>
                </Panel>
              )}
            </div>
          )}
        </div>
      )}

      <PatientModal
        isOpen={patientOpen}
        onClose={() => setPatientOpen(false)}
        patient={null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patients'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
        }}
      />
      <AppointmentModal
        isOpen={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })}
      />
    </div>
  )
}

export default Dashboard
