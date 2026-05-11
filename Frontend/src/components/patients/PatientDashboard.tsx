import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RiTeamLine,
  RiUserAddLine,
  RiCalendarLine,
  RiBox3Line,
  RiReceiptLine,
  RiMoneyDollarCircleLine,
  RiAlertLine,
  RiCheckLine,
  RiTimeLine,
  RiArrowRightSLine,
  RiFileTextLine,
  RiEyeLine,
  RiShieldCheckLine,
} from '@remixicon/react'
import { dashboardApi } from '@/api/dashboard.api'
import { salesOrdersApi } from '@/api/erp.api'
import { invoicesApi } from '@/api/invoices.api'
import { patientsApi } from '@/api/patients.api'
import { appointmentsApi } from '@/api/appointments.api'
import { auditLogsApi } from '@/api/erp.api'
import { formatCurrency } from '@/utils/formatters'

// ─── helpers ───────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function weekFromNow() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function auditLabel(action: string, entityType: string): string {
  const entity = entityType.replace(/_/g, ' ').toLowerCase()
  const map: Record<string, string> = {
    CREATE: 'created',
    UPDATE: 'updated',
    DELETE: 'deleted',
    CANCEL: 'cancelled',
    COMPLETE: 'completed',
  }
  return `${map[action] ?? action.toLowerCase()} ${entity}`
}

const ENTITY_ICON: Record<string, React.ElementType> = {
  PATIENT: RiTeamLine,
  INVOICE: RiReceiptLine,
  APPOINTMENT: RiCalendarLine,
  PRESCRIPTION: RiEyeLine,
  SALES_ORDER: RiBox3Line,
  PAYMENT: RiMoneyDollarCircleLine,
}

const ENTITY_COLOR: Record<string, string> = {
  PATIENT: 'bg-blue-500/20 text-blue-400',
  INVOICE: 'bg-amber-500/20 text-amber-400',
  APPOINTMENT: 'bg-violet-500/20 text-violet-400',
  PRESCRIPTION: 'bg-emerald-500/20 text-emerald-400',
  SALES_ORDER: 'bg-orange-500/20 text-orange-400',
  PAYMENT: 'bg-green-500/20 text-green-400',
}

// ─── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  iconColor: string
  label: string
  value: number | string | undefined
  description: string
  badge?: { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
  loading?: boolean
}

function StatCard({ icon: Icon, iconColor, label, value, description, badge, loading }: StatCardProps) {
  return (
    <Card className="border-border/60 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconColor}`}>
            <Icon className="size-4" />
          </div>
          {badge && (
            <Badge variant={badge.variant ?? 'secondary'} className="text-[10px] h-5 px-1.5">
              {badge.label}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-7 w-12 mb-1" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-foreground">{value ?? '—'}</p>
          )}
          <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Attention row ──────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'destructive' | 'success'

interface AlertRow {
  id: string
  severity: Severity
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}

const SEVERITY_STYLES: Record<Severity, { bar: string; badge: string; badgeLabel: string }> = {
  info:        { bar: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    badgeLabel: 'Info' },
  warning:     { bar: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', badgeLabel: 'Review' },
  destructive: { bar: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20',       badgeLabel: 'Urgent' },
  success:     { bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', badgeLabel: 'Done' },
}

function AttentionRow({ severity, title, subtitle, action }: Omit<AlertRow, 'id'>) {
  const s = SEVERITY_STYLES[severity]
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors group">
      <div className={`h-7 w-0.5 rounded-full shrink-0 ${s.bar}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${s.badge}`}>
          {s.badgeLabel}
        </span>
        {action && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
            onClick={action.onClick}
          >
            <RiArrowRightSLine className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Activity row ───────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  entityType: string
  description: string
  timestamp: string
  userId: string
}

function ActivityRow({ entityType, description, timestamp, userId }: Omit<ActivityItem, 'id'>) {
  const Icon = ENTITY_ICON[entityType] ?? RiFileTextLine
  const colorClass = ENTITY_COLOR[entityType] ?? 'bg-muted text-muted-foreground'
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 hover:bg-muted/30 rounded-lg transition-colors">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorClass} mt-0.5`}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground leading-snug">{description}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {userId ? `by ${userId.slice(0, 8)}… · ` : ''}{relativeTime(timestamp)}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

interface PatientDashboardProps {
  totalPatients?: number
}

export default function PatientDashboard({ totalPatients }: PatientDashboardProps) {
  const navigate = useNavigate()
  const today = todayIso()
  const nextWeek = weekFromNow()
  const monthStart = startOfMonth()

  const { data: dashStats, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    staleTime: 2 * 60 * 1000,
  })

  const { data: pickupsData, isLoading: pickupsLoading } = useQuery({
    queryKey: ['sales-orders-ready'],
    queryFn: () => salesOrdersApi.getAll({ status: 'ready', page_size: 10 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: activeOrdersData } = useQuery({
    queryKey: ['sales-orders-in-production'],
    queryFn: () => salesOrdersApi.getAll({ status: 'in_production', page_size: 1 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: overdueInvoicesData, isLoading: overdueLoading } = useQuery({
    queryKey: ['invoices-overdue'],
    queryFn: () => invoicesApi.getAll({ payment_status: 'overdue', page_size: 10 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: pendingInvoicesData } = useQuery({
    queryKey: ['invoices-pending'],
    queryFn: () => invoicesApi.getAll({ payment_status: 'pending', page_size: 1 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: recentPatientsData } = useQuery({
    queryKey: ['patients-recent-month'],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 50, sort_by: 'created_at', sort_order: 'desc' }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: upcomingApptData, isLoading: apptLoading } = useQuery({
    queryKey: ['appointments-upcoming', today, nextWeek],
    queryFn: () => appointmentsApi.getAll({ start_date: today, end_date: nextWeek, page_size: 10 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs-recent'],
    queryFn: () => auditLogsApi.getAll({ page_size: 15 }),
    staleTime: 60 * 1000,
  })

  // ── Derived stats ──────────────────────────────────────────────────────────

  const newThisMonth = useMemo(() => {
    if (!recentPatientsData?.data) return undefined
    return recentPatientsData.data.filter((p) => {
      const created = p.created_at?.split('T')[0] ?? ''
      return created >= monthStart
    }).length
  }, [recentPatientsData, monthStart])

  const unpaidCount = (pendingInvoicesData?.total ?? 0) + (overdueInvoicesData?.total ?? 0)

  // ── Needs Attention alerts ─────────────────────────────────────────────────

  const attentionRows: AlertRow[] = useMemo(() => {
    const rows: AlertRow[] = []

    // Overdue invoices (destructive)
    overdueInvoicesData?.data?.slice(0, 4).forEach((inv) => {
      rows.push({
        id: `inv-${inv.invoice_id}`,
        severity: 'destructive',
        title: `Invoice overdue — ${inv.patient_name}`,
        subtitle: `${formatCurrency(inv.balance_due)} outstanding · due ${inv.due_date?.split('T')[0] ?? '—'}`,
        action: { label: 'View', onClick: () => navigate('/invoices') },
      })
    })

    // Pending pickups (warning)
    pickupsData?.data?.slice(0, 4).forEach((order) => {
      rows.push({
        id: `order-${order.order_id}`,
        severity: 'warning',
        title: `Ready for pickup — ${order.patient_name ?? order.order_number}`,
        subtitle: `Order ${order.order_number} · ${formatCurrency(order.total_amount)}`,
        action: { label: 'View', onClick: () => navigate('/sales-orders') },
      })
    })

    // Upcoming appointments this week (info)
    upcomingApptData?.data?.slice(0, 3).forEach((appt) => {
      rows.push({
        id: `appt-${appt.appointment_id}`,
        severity: 'info',
        title: `${appt.type === 'follow-up' ? 'Follow-up' : 'Appointment'} — ${appt.patient_name}`,
        subtitle: `${appt.appointment_date} at ${appt.appointment_time} · Dr. ${appt.doctor_name}`,
        action: { label: 'View', onClick: () => navigate('/appointments') },
      })
    })

    return rows
  }, [overdueInvoicesData, pickupsData, upcomingApptData, navigate])

  // ── Activity feed ──────────────────────────────────────────────────────────

  const activityItems: ActivityItem[] = useMemo(() => {
    if (!auditData?.data) return []
    return auditData.data.map((log) => ({
      id: log.log_id,
      entityType: log.entity_type,
      description: auditLabel(log.action, log.entity_type),
      timestamp: log.timestamp ?? log.created_at,
      userId: log.user_id,
    }))
  }, [auditData])

  const statsLoading = dashLoading || pickupsLoading

  return (
    <div className="space-y-4">
      {/* ── Patient Summary Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={RiTeamLine}
          iconColor="bg-blue-500/15 text-blue-400"
          label="Total Patients"
          value={totalPatients ?? dashStats?.total_patients}
          description="All registered patients"
          loading={statsLoading && !totalPatients}
        />
        <StatCard
          icon={RiUserAddLine}
          iconColor="bg-emerald-500/15 text-emerald-400"
          label="New This Month"
          value={newThisMonth}
          description="Joined since month start"
          badge={newThisMonth ? { label: `+${newThisMonth}`, variant: 'secondary' } : undefined}
          loading={!recentPatientsData}
        />
        <StatCard
          icon={RiCalendarLine}
          iconColor="bg-violet-500/15 text-violet-400"
          label="Appointments Today"
          value={dashStats?.today_appointments}
          description="Scheduled for today"
          loading={dashLoading}
        />
        <StatCard
          icon={RiBox3Line}
          iconColor="bg-orange-500/15 text-orange-400"
          label="Pending Pickups"
          value={pickupsData?.total}
          description="Orders ready to collect"
          badge={pickupsData?.total ? { label: 'Ready', variant: 'outline' } : undefined}
          loading={pickupsLoading}
        />
        <StatCard
          icon={RiShieldCheckLine}
          iconColor="bg-sky-500/15 text-sky-400"
          label="Active Orders"
          value={(activeOrdersData?.total ?? 0)}
          description="In production now"
          loading={!activeOrdersData}
        />
        <StatCard
          icon={RiMoneyDollarCircleLine}
          iconColor="bg-red-500/15 text-red-400"
          label="Unpaid Invoices"
          value={unpaidCount || undefined}
          description="Pending + overdue"
          badge={overdueInvoicesData?.total ? { label: `${overdueInvoicesData.total} overdue`, variant: 'destructive' } : undefined}
          loading={overdueLoading}
        />
      </div>

      {/* ── Needs Attention + Activity ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Needs Attention — spans 2 cols */}
        <Card className="border-border/60 bg-card/50 lg:col-span-2">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15">
                  <RiAlertLine className="size-4 text-amber-400" />
                </div>
                <CardTitle className="text-sm font-semibold">Needs Attention</CardTitle>
              </div>
              {attentionRows.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {attentionRows.length} items
                </Badge>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-2">
            {(dashLoading || overdueLoading || apptLoading) && attentionRows.length === 0 ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-7 w-0.5 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : attentionRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 mb-3">
                  <RiCheckLine className="size-5 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground mt-1">No urgent items require attention</p>
              </div>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-0.5 p-1">
                  {attentionRows.map((row, i) => (
                    <div key={row.id}>
                      <AttentionRow
                        severity={row.severity}
                        title={row.title}
                        subtitle={row.subtitle}
                        action={row.action}
                      />
                      {i < attentionRows.length - 1 && (
                        <Separator className="mx-3 my-0.5 opacity-40" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity — spans 1 col */}
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/15">
                <RiTimeLine className="size-4 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-2">
            {auditLoading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 px-3">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                  <RiFileTextLine className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">Activity will appear as staff work</p>
              </div>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-0.5 p-1">
                  {activityItems.map((item, i) => (
                    <div key={item.id}>
                      <ActivityRow
                        entityType={item.entityType}
                        description={item.description}
                        timestamp={item.timestamp}
                        userId={item.userId}
                      />
                      {i < activityItems.length - 1 && (
                        <Separator className="mx-3 my-0.5 opacity-30" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
