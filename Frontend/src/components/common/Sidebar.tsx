import { NavLink } from 'react-router-dom'
import {
  HomeLine,
  Users01,
  Calendar,
  File06,
  Package,
  Receipt,
  BarChart07,
  LogOut01,
  UserCheck01,
} from '@untitledui/icons'
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
  { name: 'Dashboard', path: '/', icon: HomeLine },
  { name: 'Patients', path: '/patients', icon: Users01 },
  { name: 'Appointments', path: '/appointments', icon: Calendar },
  { name: 'Prescriptions', path: '/prescriptions', icon: File06 },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Invoices', path: '/invoices', icon: Receipt },
  { name: 'Doctors', path: '/doctors', icon: UserCheck01 },
  { name: 'Reports', path: '/reports', icon: BarChart07 },
]

const Sidebar = () => {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col transition-all duration-300 z-50 shadow-xl shadow-gray-200/50 dark:shadow-none">
      {/* Brand */}
      <div className="p-6 pb-2">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-600 shadow-lg shadow-brand-600/30">
            <span className="text-white font-bold text-lg">EC</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight">Sequence</h1>
            <p className="text-xs text-tertiary">Eye Care ERP</p>
          </div>
        </div>
        <p className="px-4 text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Menu</p>
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
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                  : 'text-secondary hover:bg-secondary hover:text-primary'
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
                        : 'text-tertiary group-hover:text-secondary'
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
        <div className="bg-bg-tertiary rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-tertiary transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-brand-600 font-bold shadow-sm">
              {user?.name ? getInitials(user.name) : <Users01 className="w-5 h-5" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-primary truncate max-w-[100px]">{user?.name || 'User'}</p>
              <p className="text-xs text-tertiary truncate">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-tertiary hover:text-error-500 transition-colors"
            title="Logout"
          >
            <LogOut01 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
