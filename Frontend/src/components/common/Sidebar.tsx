import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Package,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/utils/helpers'

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
  { name: 'Reports', path: '/reports', icon: BarChart3 },
]

const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-bg-secondary border-r border-border overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary font-semibold shadow-sm border border-blue-500/20'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-text-tertiary group-hover:text-text-secondary'
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings at Bottom */}
      <div className="absolute bottom-4 left-4 right-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
              isActive
                ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary font-semibold shadow-sm border border-blue-500/20'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            )
          }
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
