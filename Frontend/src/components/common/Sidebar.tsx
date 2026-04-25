import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  RiHomeLine,
  RiTeamLine,
  RiCalendarLine,
  RiFileTextLine,
  RiBox3Line,
  RiTruckLine,
  RiReceiptLine,
  RiBarChartLine,
  RiBarChart2Line,
  RiMoneyDollarCircleLine,
  RiAlertLine,
  RiKeyLine,
  RiBellLine,
  RiLogoutBoxRLine,
  RiUserFollowLine,
  RiArrowUpDownLine,
  RiSettings4Line,
} from '@remixicon/react'
import { cn } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'
import { Button } from '@/components/ui/button'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
  children?: NavItem[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navigationSections: NavSection[] = [
  {
    items: [
      { name: 'Dashboard', path: '/', icon: RiHomeLine },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { name: 'Patients', path: '/patients', icon: RiTeamLine },
      { name: 'Appointments', path: '/appointments', icon: RiCalendarLine },
      { name: 'Prescriptions', path: '/prescriptions', icon: RiFileTextLine },
      { name: 'Doctors', path: '/doctors', icon: RiUserFollowLine },
    ],
  },
  {
    title: 'Sales',
    items: [
      { name: 'Sales Orders', path: '/sales-orders', icon: RiReceiptLine },
      { name: 'Invoices', path: '/invoices', icon: RiFileTextLine },
      { name: 'Payments', path: '/payments', icon: RiMoneyDollarCircleLine },
      { name: 'Refunds', path: '/refunds', icon: RiAlertLine },
    ],
  },
  {
    title: 'Purchasing',
    items: [
      { name: 'Suppliers', path: '/suppliers', icon: RiTeamLine },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: RiTruckLine },
      { name: 'Stock Receipts', path: '/stock-receipts', icon: RiBox3Line },
      { name: 'Supplier Invoices', path: '/supplier-invoices', icon: RiFileTextLine },
      { name: 'Supplier Payments', path: '/supplier-payments', icon: RiMoneyDollarCircleLine },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { name: 'Products', path: '/products', icon: RiBox3Line },
      { name: 'Inventory Movements', path: '/inventory-movements', icon: RiBarChart2Line },
      { name: 'Stock Adjustments', path: '/stock-adjustments', icon: RiSettings4Line },
    ],
  },
  {
    title: 'Finance',
    items: [
      { name: 'Transactions', path: '/transactions', icon: RiBarChart2Line },
      { name: 'Ledger', path: '/ledger', icon: RiBarChartLine },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { name: 'Reports', path: '/reports', icon: RiBarChartLine },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Users', path: '/users', icon: RiTeamLine },
      { name: 'Roles & Permissions', path: '/roles-permissions', icon: RiKeyLine },
      { name: 'Activity Logs', path: '/activity-logs', icon: RiBellLine },
      { name: 'Company Profile', path: '/settings', icon: RiSettings4Line },
      {
        name: 'Basic Data',
        path: '/basic-data',
        icon: RiSettings4Line,
        children: [
          { name: 'Other Expenses', path: '/basic-data/other-expenses', icon: RiSettings4Line },
          { name: 'Lenses', path: '/basic-data/lenses', icon: RiSettings4Line },
        ],
      },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navigateTo = (path: string) => {
    if (location.pathname === path) {
      onClose?.()
      return
    }
    navigate(path)
    onClose?.()
    requestAnimationFrame(() => {
      if (window.location.pathname !== path) {
        window.location.assign(path)
      }
    })
  }

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    navigationSections.reduce<Record<string, boolean>>((acc, section) => {
      if (section.title) acc[section.title] = true
      return acc
    }, {})
  )
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'System-Basic Data': true,
  })
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false)
      }
    }
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isAccountMenuOpen])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
            <span className="text-lg font-bold text-sidebar-primary-foreground">EC</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground">Sequence</span>
            <span className="text-xs text-muted-foreground">Eye Care ERP</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
          <div className="flex flex-col gap-4">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="flex flex-col gap-1">
                {section.title && (
                  <button
                    type="button"
                    onClick={() => setOpenSections((current) => ({
                      ...current,
                      [section.title!]: !current[section.title!],
                    }))}
                    className="flex w-full items-center justify-between px-3 pb-2 pt-1 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </span>
                    <RiArrowUpDownLine className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      openSections[section.title] ? 'rotate-180' : ''
                    )} />
                  </button>
                )}
                {(!section.title || openSections[section.title]) && section.items.map((item) => {
                  if (item.children?.length) {
                    const submenuKey = `${section.title || 'root'}-${item.name}`
                    const isSubmenuOpen = openSubMenus[submenuKey] ?? true
                    const hasActiveChild = item.children.some((child) => location.pathname === child.path)

                    return (
                      <div key={submenuKey} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setOpenSubMenus((current) => ({
                            ...current,
                            [submenuKey]: !isSubmenuOpen,
                          }))}
                          className={cn(
                            'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all duration-100 ease-linear',
                            hasActiveChild
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className={cn(
                            'h-5 w-5 shrink-0 transition-colors duration-100',
                            hasActiveChild
                              ? 'text-sidebar-primary'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )} />
                          <span className="flex-1 truncate text-left">{item.name}</span>
                          <RiArrowUpDownLine className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            isSubmenuOpen ? 'rotate-180' : ''
                          )} />
                        </button>

                        {isSubmenuOpen && (
                          <div className="ml-6 space-y-1 border-l border-border pl-2">
                            {item.children.map((child) => (
                              <button
                                key={child.path}
                                type="button"
                                onClick={() => navigateTo(child.path)}
                                className={cn(
                                  'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all duration-100 ease-linear',
                                  location.pathname === child.path
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                              >
                                <child.icon className={cn(
                                  'h-4 w-4 shrink-0 transition-colors duration-100',
                                  location.pathname === child.path
                                    ? 'text-sidebar-primary'
                                    : 'text-muted-foreground group-hover:text-foreground'
                                )} />
                                <span className="flex-1 truncate text-left">{child.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onClose}
                      className={({ isActive }) => cn(
                        'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all duration-100 ease-linear',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn(
                            'h-5 w-5 shrink-0 transition-colors duration-100',
                            isActive
                              ? 'text-sidebar-primary'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )} />
                          <span className="flex-1 truncate">{item.name}</span>
                          {item.badge && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-xs font-medium text-sidebar-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Account Card */}
        <div className="border-t border-border bg-background/60 p-4" ref={accountMenuRef}>
          <div className="relative">
            <div
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/50"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 font-semibold text-sidebar-primary">
                {user?.name ? getInitials(user.name) : <RiTeamLine className="h-5 w-5" />}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {user?.name || 'User'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email || user?.role || 'admin@eyecare.com'}
                </span>
              </div>
              <RiArrowUpDownLine className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>

            {isAccountMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-md border border-border bg-popover p-2 shadow-lg">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm font-semibold text-muted-foreground hover:text-foreground"
                  onClick={logout}
                >
                  <RiLogoutBoxRLine className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
