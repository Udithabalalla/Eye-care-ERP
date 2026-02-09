import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard.api'
import Loading from '@/components/common/Loading'
import {
  Users,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Package,
  Plus,
  Activity
} from 'lucide-react'
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
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Low Stock Items',
      value: stats?.low_stock_items || 0,
      icon: Package,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(stats?.pending_payments || 0),
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ]

  return (
    <div className="space-y-8 fade-in-up">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Overview of your practice performance.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/appointments')}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-border rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            View Schedule
          </button>
          <button
            onClick={() => navigate('/patients')}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Patient
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hero Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#003e49] to-[#0f766e] text-white p-8 shadow-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-teal-100 font-medium mb-1">Total Revenue (This Month)</h2>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-bold tracking-tight">{formatCurrency(stats?.revenue_month || 0)}</span>
                  <div className="flex items-center text-teal-300 bg-white/10 px-2 py-1 rounded-lg text-sm font-medium backdrop-blur-sm">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    <span>+12.5%</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <DollarSign className="w-8 h-8 text-teal-200" />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 bg-white text-teal-900 px-6 py-3 rounded-xl font-bold hover:bg-teal-50 transition-colors shadow-md">
                <Plus className="w-5 h-5" />
                New Invoice
              </button>
              <button onClick={() => navigate('/reports')} className="flex items-center gap-2 bg-teal-800/50 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-800/70 border border-teal-700/50 transition-colors backdrop-blur-sm">
                <Activity className="w-5 h-5" />
                View Reports
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Quick Stats */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-border hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-text-secondary">Total</span>
            </div>
            <div>
              <p className="text-text-secondary text-sm font-medium">Active Patients</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{stats?.total_patients || 0}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-border hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-lg">Today</span>
            </div>
            <div>
              <p className="text-text-secondary text-sm font-medium">Appointments</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{stats?.today_appointments || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div>
        <h3 className="text-xl font-bold text-text-primary mb-6">Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {secondaryStats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-border shadow-sm flex items-center space-x-4 hover:border-primary/50 transition-colors cursor-default">
                <div className={`p-4 rounded-2xl ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">{stat.title}</p>
                  <p className="text-xl font-bold text-text-primary mt-1">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
