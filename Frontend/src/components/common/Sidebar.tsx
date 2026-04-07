import { NavLink } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  HomeLine,
  Users01,
  Calendar,
  File06,
  Package,
  Truck01,
  Receipt,
  BarChart07,
  LogOut01,
  UserCheck01,
  ChevronSelectorVertical,
  Settings01,
} from '@untitledui/icons'
import { cn } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navigationSections: NavSection[] = [
  {
    items: [
      { name: 'Dashboard', path: '/', icon: HomeLine },
    ],
  },
  {
    title: 'Management',
    items: [
      { name: 'Patients', path: '/patients', icon: Users01 },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'Prescriptions', path: '/prescriptions', icon: File06 },
      { name: 'Doctors', path: '/doctors', icon: UserCheck01 },
    ],
  },
  {
    title: 'Inventory & Sales',
    items: [
      { name: 'Suppliers', path: '/suppliers', icon: Users01 },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: Truck01 },
      { name: 'Stock Receipts', path: '/stock-receipts', icon: Package },
      { name: 'Supplier Invoices', path: '/supplier-invoices', icon: File06 },
      { name: 'Supplier Payments', path: '/supplier-payments', icon: Receipt },
      { name: 'Products', path: '/products', icon: Package },
      { name: 'Invoices', path: '/invoices', icon: Receipt },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { name: 'Reports', path: '/reports', icon: BarChart07 },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'PO Header Settings', path: '/settings', icon: Settings01 },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false)
      }
    }

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isAccountMenuOpen])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col z-50 border-r border-border transition-transform duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
            <span className="text-lg font-bold text-white">EC</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-primary">Sequence</span>
            <span className="text-xs text-tertiary">Eye Care ERP</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
          <div className="flex flex-col gap-6">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="flex flex-col gap-1">
                {section.title && (
                  <div className="px-3 pb-2 pt-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                      {section.title}
                    </span>
                  </div>
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all duration-100 ease-linear',
                        isActive
                          ? 'bg-bg-active text-primary'
                          : 'text-secondary hover:bg-bg-primary-hover hover:text-primary'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'h-5 w-5 shrink-0 transition-colors duration-100',
                            isActive
                              ? 'text-brand-600'
                              : 'text-quaternary group-hover:text-tertiary'
                          )}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* Account Card */}
        <div className="border-t border-border p-4" ref={accountMenuRef}>
          <div className="relative">
            <div
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 ring-border ring-inset transition-colors hover:bg-bg-primary-hover"
            >
              {/* Avatar */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold">
                {user?.name ? getInitials(user.name) : <Users01 className="h-5 w-5" />}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar bg-success-500" />
              </div>

              {/* User Info */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-primary">
                  {user?.name || 'User'}
                </span>
                <span className="truncate text-xs text-tertiary">
                  {user?.email || user?.role || 'admin@eyecare.com'}
                </span>
              </div>

              {/* Expand Icon */}
              <ChevronSelectorVertical className="h-5 w-5 shrink-0 text-quaternary" />
            </div>

            {/* Account Menu Dropdown */}
            {isAccountMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-primary p-1.5 shadow-lg">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-secondary hover:bg-bg-primary-hover hover:text-primary transition-colors"
                  >
                    <LogOut01 className="h-5 w-5 text-quaternary" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
