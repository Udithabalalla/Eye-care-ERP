import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Package,
  Receipt,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'Appointments', path: '/appointments', icon: Calendar },
  { name: 'Prescriptions', path: '/prescriptions', icon: FileText },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Invoices', path: '/invoices', icon: Receipt },
  { name: 'Doctors', path: '/doctors', icon: Users },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
]

const Sidebar = () => {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col transition-all duration-300 z-50 shadow-xl shadow-gray-200/50 dark:shadow-none">
      {/* Brand */}
      <div className="p-6 pb-2">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary shadow-lg shadow-primary/30">
            <span className="text-white font-bold text-lg">EC</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Sequence</h1>
            <p className="text-xs text-text-tertiary">Eye Care ERP</p>
          </div>
        </div>
        <p className="px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Menu</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 group',
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-gray-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center space-x-3">
                  <item.icon
                    className={cn(
                      'w-5 h-5 transition-all duration-200',
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    )}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-4 mt-auto">
        <div className="bg-bg-tertiary rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary font-bold shadow-sm">
              {user?.name ? getInitials(user.name) : <Users className="w-5 h-5" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-text-primary truncate max-w-[100px]">{user?.name || 'User'}</p>
              <p className="text-xs text-text-tertiary truncate">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-text-tertiary hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
