import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard.api'
import Loading from '@/components/common/Loading'
import {
  Users01,
  Calendar,
  CurrencyDollar,
  AlertTriangle,
  Package,
  Plus,
  ArrowRight,
} from '@untitledui/icons'
import { formatCurrency } from '@/utils/formatters'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  })

  if (isLoading) {
    return <Loading fullScreen text="Loading dashboard..." />
  }

  const secondaryStats = [
    {
      title: "Today's Appointments",
      value: stats?.today_appointments || 0,
      icon: Calendar,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
    {
      title: 'Low Stock Items',
      value: stats?.low_stock_items || 0,
      icon: Package,
      color: 'text-error-500',
      bgColor: 'bg-error-50',
    },
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: Users01,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(stats?.pending_payments || 0),
      icon: AlertTriangle,
      color: 'text-warning-500',
      bgColor: 'bg-warning-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Dashboard</h1>
          <p className="mt-1 text-[17px] text-secondary">Overview of your practice performance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/appointments')}
            className="inline-flex items-center gap-2 rounded-pill border border-brand-700 px-4 py-2 text-[14px] text-brand-700 transition-colors hover:underline"
          >
            View Schedule
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/patients')}
            className="inline-flex items-center gap-2 rounded-apple bg-brand-600 px-4 py-2 text-[17px] text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Patient
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-apple-lg bg-black text-white shadow-card">
        <div className="grid grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[1.4fr_1fr] md:px-10">
          <div className="space-y-6">
            <div>
              <p className="text-[14px] tracking-[-0.224px] text-white/72">Revenue this month</p>
              <h2 className="mt-2 font-display text-[56px] font-semibold leading-[1.07] tracking-[-0.28px] text-white">
                {formatCurrency(stats?.revenue_month || 0)}
              </h2>
              <p className="mt-2 max-w-xl text-[17px] tracking-[-0.374px] text-white/78">
                Operational summary for billing, appointments, and patient throughput in the current cycle.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/invoices')}
                className="inline-flex items-center gap-2 rounded-apple bg-brand-600 px-4 py-2 text-[17px] text-white transition-colors hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                New Invoice
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="inline-flex items-center gap-2 rounded-pill border border-white/30 px-4 py-2 text-[14px] text-white transition-colors hover:underline"
              >
                View Reports
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <article className="rounded-apple bg-[#272729] p-4">
              <p className="text-[12px] text-white/62">Today's Appointments</p>
              <p className="mt-1 text-[28px] font-medium tracking-[0.196px] text-white">{stats?.today_appointments || 0}</p>
            </article>
            <article className="rounded-apple bg-[#272729] p-4">
              <p className="text-[12px] text-white/62">Total Patients</p>
              <p className="mt-1 text-[28px] font-medium tracking-[0.196px] text-white">{stats?.total_patients || 0}</p>
            </article>
            <article className="col-span-2 rounded-apple bg-[#272729] p-4 md:col-span-1">
              <p className="text-[12px] text-white/62">Pending Payments</p>
              <p className="mt-1 text-[28px] font-medium tracking-[0.196px] text-white">{formatCurrency(stats?.pending_payments || 0)}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="rounded-apple-lg bg-[#f5f5f7] p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[28px] font-normal leading-[1.14] tracking-[0.196px] text-primary">Practice Pulse</h3>
          <CurrencyDollar className="h-6 w-6 text-brand-600" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {secondaryStats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <article key={index} className="rounded-apple bg-white p-5 shadow-xs ring-1 ring-[#d2d2d7]">
                <div className="mb-4 flex items-center justify-between">
                  <div className={`rounded-apple p-2.5 ${stat.bgColor} ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[14px] tracking-[-0.224px] text-secondary">{stat.title}</p>
                <p className="mt-1 text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">{stat.value}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-apple-lg bg-white p-6 shadow-xs ring-1 ring-[#d2d2d7]">
          <div className="mb-3 flex items-center gap-3">
            <Users01 className="h-5 w-5 text-brand-600" />
            <p className="text-[17px] font-semibold">Patients Waiting</p>
          </div>
          <p className="text-[40px] font-semibold leading-[1.1] tracking-[-0.28px]">{stats?.today_appointments || 0}</p>
          <p className="mt-2 text-[14px] text-secondary">Includes walk-ins and scheduled visits for today.</p>
        </article>

        <article className="rounded-apple-lg bg-white p-6 shadow-xs ring-1 ring-[#d2d2d7]">
          <div className="mb-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-brand-600" />
            <p className="text-[17px] font-semibold">Low Stock Alerts</p>
          </div>
          <p className="text-[40px] font-semibold leading-[1.1] tracking-[-0.28px]">{stats?.low_stock_items || 0}</p>
          <p className="mt-2 text-[14px] text-secondary">Reorder sensitive products to avoid fulfillment delays.</p>
        </article>
      </section>
    </div>
  )
}

export default Dashboard
