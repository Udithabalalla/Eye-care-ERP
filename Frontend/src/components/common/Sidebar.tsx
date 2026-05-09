import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
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
  RiSettings4Line,
  RiArrowDownSLine,
  RiMore2Line,
} from '@remixicon/react'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
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

const AppSidebar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    navigationSections.reduce<Record<string, boolean>>((acc, section) => {
      if (section.title) acc[section.title] = true
      return acc
    }, {})
  )

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'Basic Data': true,
  })

  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))

  const toggleSubMenu = (name: string) =>
    setOpenSubMenus((prev) => ({ ...prev, [name]: !prev[name] }))

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <ShadcnSidebar collapsible="icon">
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-3 cursor-default select-none">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-sm font-bold">EC</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Sequence</span>
                  <span className="truncate text-xs text-muted-foreground">Eye Care ERP</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {navigationSections.map((section, sectionIdx) => (
          <SidebarGroup key={sectionIdx}>
            {section.title && (
              <Collapsible
                open={openGroups[section.title]}
                onOpenChange={() => toggleGroup(section.title!)}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between hover:text-foreground transition-colors group/label">
                    {section.title}
                    <RiArrowDownSLine className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/label:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      if (item.children?.length) {
                        const isSubmenuOpen = openSubMenus[item.name] ?? true
                        const hasActiveChild = item.children.some((c) =>
                          location.pathname.startsWith(c.path)
                        )
                        return (
                          <Collapsible
                            key={item.name}
                            open={isSubmenuOpen}
                            onOpenChange={() => toggleSubMenu(item.name)}
                            asChild
                          >
                            <SidebarMenuItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                  tooltip={item.name}
                                  isActive={hasActiveChild}
                                >
                                  <item.icon />
                                  <span>{item.name}</span>
                                  <RiArrowDownSLine className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {item.children.map((child) => (
                                    <SidebarMenuSubItem key={child.path}>
                                      <SidebarMenuSubButton asChild isActive={isActive(child.path)}>
                                        <NavLink to={child.path}>
                                          <child.icon />
                                          <span>{child.name}</span>
                                        </NavLink>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuItem>
                          </Collapsible>
                        )
                      }

                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.name}
                            isActive={isActive(item.path)}
                          >
                            <NavLink to={item.path} end={item.path === '/'}>
                              <item.icon />
                              <span>{item.name}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Ungrouped section (Dashboard) */}
            {!section.title && (
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.name}
                      isActive={isActive(item.path)}
                    >
                      <NavLink to={item.path} end>
                        <item.icon />
                        <span>{item.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary text-xs font-semibold">
                      {user?.name ? getInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name || 'User'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email || user?.role || ''}
                    </span>
                  </div>
                  <RiMore2Line className="ml-auto h-4 w-4 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                  <RiLogoutBoxRLine className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </ShadcnSidebar>
  )
}

export default AppSidebar
