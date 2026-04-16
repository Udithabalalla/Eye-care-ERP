import { NavLink, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import {
  HomeLine,
  Users01,
  Calendar,
  File06,
  Package,
  Truck01,
  Receipt,
  BarChart07,
  BarChart02,
  CurrencyDollar,
  AlertTriangle,
  Key01,
  Bell01,
  LogOut01,
  UserCheck01,
  Settings01,
} from '@untitledui/icons'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'
import {
  Sidebar as SidebarShell,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

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
    title: 'Clinical',
    items: [
      { name: 'Patients', path: '/patients', icon: Users01 },
      { name: 'Appointments', path: '/appointments', icon: Calendar },
      { name: 'Prescriptions', path: '/prescriptions', icon: File06 },
      { name: 'Doctors', path: '/doctors', icon: UserCheck01 },
    ],
  },
  {
    title: 'Sales',
    items: [
      { name: 'Sales Orders', path: '/invoices', icon: Receipt },
      { name: 'Payments', path: '/payments', icon: CurrencyDollar },
      { name: 'Refunds', path: '/refunds', icon: AlertTriangle },
    ],
  },
  {
    title: 'Purchasing',
    items: [
      { name: 'Suppliers', path: '/suppliers', icon: Users01 },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: Truck01 },
      { name: 'Stock Receipts', path: '/stock-receipts', icon: Package },
      { name: 'Supplier Invoices', path: '/supplier-invoices', icon: File06 },
      { name: 'Supplier Payments', path: '/supplier-payments', icon: CurrencyDollar },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { name: 'Products', path: '/products', icon: Package },
      { name: 'Inventory Movements', path: '/inventory-movements', icon: BarChart02 },
      { name: 'Stock Adjustments', path: '/stock-adjustments', icon: Settings01 },
    ],
  },
  {
    title: 'Finance',
    items: [
      { name: 'Transactions', path: '/transactions', icon: BarChart02 },
      { name: 'Ledger', path: '/ledger', icon: BarChart07 },
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
      { name: 'Users', path: '/users', icon: Users01 },
      { name: 'Roles & Permissions', path: '/roles-permissions', icon: Key01 },
      { name: 'Activity Logs', path: '/activity-logs', icon: Bell01 },
      { name: 'Company Profile', path: '/settings', icon: Settings01 },
    ],
  },
]

const AppSidebar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const currentPath = location.pathname

  const isActive = useMemo(
    () => (path: string) => {
      if (path === '/') return currentPath === '/'
      return currentPath === path || currentPath.startsWith(`${path}/`)
    },
    [currentPath]
  )

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarShell collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">EC</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Sequence</span>
            <span className="text-xs text-muted-foreground">Eye Care ERP</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationSections.map((section, sectionIndex) => (
          <SidebarGroup key={sectionIndex}>
            {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.name}>
                    <NavLink to={item.path} end={item.path === '/'} onClick={closeMobileSidebar}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <div className="flex items-center gap-3 rounded-md p-2">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground">
            {user?.name ? getInitials(user.name) : <Users01 className="h-5 w-5" />}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold">
              {user?.name || 'User'}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email || user?.role || 'admin@eyecare.com'}
            </span>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="Sign out">
                <LogOut01 className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarShell>
  )
}

export default AppSidebar
