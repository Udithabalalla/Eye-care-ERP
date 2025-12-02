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
} from 'lucide-react'
import { formatCurrency } from '@/utils/formatters'

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  })

  if (isLoading) {
    return <Loading fullScreen text="Loading dashboard..." />
  }

  const statCards = [
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: "Today's Appointments",
      value: stats?.today_appointments || 0,
      icon: Calendar,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Revenue Today',
      value: formatCurrency(stats?.revenue_today || 0),
      icon: DollarSign,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Revenue This Month',
      value: formatCurrency(stats?.revenue_month || 0),
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(stats?.pending_payments || 0),
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Low Stock Items',
      value: stats?.low_stock_items || 0,
      icon: Package,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary">{stat.title}</p>
                  <p className="text-2xl font-bold text-text-primary mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary justify-start">
              <Calendar className="w-5 h-5 mr-2" />
              Schedule Appointment
            </button>
            <button className="w-full btn-secondary justify-start">
              <Users className="w-5 h-5 mr-2" />
              Add New Patient
            </button>
            <button className="w-full btn-secondary justify-start">
              <Package className="w-5 h-5 mr-2" />
              Add Product
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Notifications</h3>
          <div className="space-y-3">
            {stats?.low_stock_items > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    Low Stock Alert
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {stats.low_stock_items} products need reordering
                  </p>
                </div>
              </div>
            )}
            {stats?.today_appointments > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Today's Schedule
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    You have {stats.today_appointments} appointments today
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
