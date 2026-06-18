import { NavLink, useLocation } from 'react-router-dom'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  RiHomeLine,
  RiTeamLine,
  RiCalendarLine,
  RiFileTextLine,
  RiBox3Line,
  RiTruckLine,
  RiReceiptLine,
  RiBarChartLine,
  RiFileChartLine,
  RiMoneyDollarCircleLine,
  RiRefundLine,
  RiShieldCheckLine,
  RiHistoryLine,
  RiLogoutBoxRLine,
  RiUserFollowLine,
  RiUserLine,
  RiSettings4Line,
  RiArrowDownSLine,
  RiMore2Line,
  RiShoppingCartLine,
  RiEyeLine,
  RiPriceTag3Line,
  RiWallet3Line,
  RiPercentLine,
  RiBookOpenLine,
  RiInboxLine,
  RiBankCardLine,
  RiEqualizer2Line,
  RiGridLine,
  RiArrowUpDownLine,
  RiListSettingsLine,
  RiBuilding2Line,
  RiExchangeDollarLine,
  RiArrowUpSLine,
  RiDraggable,
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
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
}

interface NavSection {
  id: string
  title?: string
  items: NavItem[]
}

const ALL_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    items: [
      { name: 'Dashboard', path: '/', icon: RiHomeLine },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    items: [
      { name: 'Frames', path: '/inventory/frames', icon: RiGridLine },
      { name: 'General Inventory', path: '/inventory/general', icon: RiBox3Line },
      { name: 'Receiving', path: '/inventory/receiving', icon: RiTruckLine },
      { name: 'Stock Movements', path: '/inventory/movements', icon: RiArrowUpDownLine },
      { name: 'Adjustments', path: '/inventory/adjustments', icon: RiEqualizer2Line },
    ],
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    items: [
      { name: 'Suppliers', path: '/suppliers', icon: RiBuilding2Line },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: RiShoppingCartLine },
      { name: 'Stock Receipts', path: '/stock-receipts', icon: RiInboxLine },
      { name: 'Supplier Invoices', path: '/supplier-invoices', icon: RiFileTextLine },
      { name: 'Supplier Payments', path: '/supplier-payments', icon: RiBankCardLine },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    items: [
      { name: 'Sales Orders', path: '/sales-orders', icon: RiReceiptLine },
      { name: 'Invoices', path: '/invoices', icon: RiFileChartLine },
      { name: 'Payments', path: '/payments', icon: RiMoneyDollarCircleLine },
      { name: 'Refunds', path: '/refunds', icon: RiRefundLine },
    ],
  },
  {
    id: 'clinical',
    title: 'Clinical',
    items: [
      { name: 'Patients', path: '/patients', icon: RiUserLine },
      { name: 'Appointments', path: '/appointments', icon: RiCalendarLine },
      { name: 'Prescriptions', path: '/prescriptions', icon: RiEyeLine },
      { name: 'Doctors', path: '/doctors', icon: RiUserFollowLine },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { name: 'Transactions', path: '/transactions', icon: RiExchangeDollarLine },
      { name: 'Ledger', path: '/ledger', icon: RiBookOpenLine },
      { name: 'Reports', path: '/reports', icon: RiBarChartLine },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { name: 'Users', path: '/users', icon: RiTeamLine },
      { name: 'Roles & Permissions', path: '/roles-permissions', icon: RiShieldCheckLine },
      { name: 'Activity Logs', path: '/activity-logs', icon: RiHistoryLine },
      { name: 'Company Profile', path: '/settings', icon: RiSettings4Line },
      {
        name: 'Basic Data',
        path: '/basic-data',
        icon: RiListSettingsLine,
        children: [
          { name: 'Other Expenses', path: '/basic-data/other-expenses', icon: RiWallet3Line },
          { name: 'Lenses', path: '/basic-data/lenses', icon: RiEyeLine },
          { name: 'Product Categories', path: '/basic-data/product-categories', icon: RiPriceTag3Line },
          { name: 'Price Rules', path: '/basic-data/complimentary-items', icon: RiPercentLine },
        ],
      },
    ],
  },
]

const STORAGE_KEY = 'nav-section-order'

function getSavedOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: string[] = JSON.parse(raw)
      const allIds = ALL_SECTIONS.map((s) => s.id)
      // merge: saved order first, then any new sections appended
      const valid = parsed.filter((id) => allIds.includes(id))
      const missing = allIds.filter((id) => !valid.includes(id))
      return [...valid, ...missing]
    }
  } catch { /* ignore */ }
  return ALL_SECTIONS.map((s) => s.id)
}

const AppSidebar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const [sectionOrder, setSectionOrder] = useState<string[]>(getSavedOrder)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])

  // Derive which section contains the active route so we can auto-expand it
  const activeSectionId = useMemo(() => {
    for (const s of ALL_SECTIONS) {
      for (const item of s.items) {
        if (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) return s.id
        if (item.children?.some((c) => location.pathname.startsWith(c.path))) return s.id
      }
    }
    return null
  }, [location.pathname])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const s of ALL_SECTIONS) {
      if (s.title) initial[s.id] = true
    }
    return initial
  })

  // Auto-expand section when navigating into it from somewhere else
  useEffect(() => {
    if (activeSectionId) {
      setOpenGroups((prev) => prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true })
    }
  }, [activeSectionId])

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'Basic Data': true,
  })

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))

  const toggleSubMenu = (name: string) =>
    setOpenSubMenus((prev) => ({ ...prev, [name]: !prev[name] }))

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const handleNavClick = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  // Build ordered sections from current sectionOrder
  const orderedSections = sectionOrder
    .map((id) => ALL_SECTIONS.find((s) => s.id === id))
    .filter(Boolean) as NavSection[]

  // Customize dialog helpers
  const openCustomize = () => {
    setDraftOrder(sectionOrder)
    setCustomizeOpen(true)
  }

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...draftOrder]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setDraftOrder(next)
  }

  const saveOrder = () => {
    setSectionOrder(draftOrder)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftOrder))
    setCustomizeOpen(false)
  }

  const resetOrder = () => {
    setDraftOrder(ALL_SECTIONS.map((s) => s.id))
  }

  // Drag-and-drop state
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const onDragStart = (idx: number) => { dragIdx.current = idx }
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOver(idx)
  }
  const onDrop = (idx: number) => {
    const from = dragIdx.current
    if (from === null || from === idx) { setDragOver(null); return }
    const next = [...draftOrder]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    setDraftOrder(next)
    dragIdx.current = null
    setDragOver(null)
  }
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null) }

  return (
    <>
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
                  <button
                    className="ml-auto p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => { e.stopPropagation(); openCustomize() }}
                    title="Customize navigation"
                  >
                    <RiListSettingsLine className="size-3.5" />
                  </button>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          {orderedSections.map((section, sectionIdx) => (
            <SidebarGroup key={sectionIdx}>
              {section.title && (
                <>
                  <SidebarGroupLabel
                    className={`flex w-full cursor-pointer items-center justify-between transition-colors select-none
                      ${openGroups[section.id]
                        ? 'text-foreground/70 hover:text-foreground'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                      }`}
                    onClick={() => toggleGroup(section.id)}
                  >
                    {section.title}
                    <RiArrowDownSLine
                      className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${openGroups[section.id] ? 'rotate-180' : ''}`}
                    />
                  </SidebarGroupLabel>

                  {openGroups[section.id] && (
                    <SidebarMenu>
                      {section.items.map((item) => {
                        if (item.children?.length) {
                          const isSubmenuOpen = openSubMenus[item.name] ?? true
                          const hasActiveChild = item.children.some((c) =>
                            location.pathname.startsWith(c.path)
                          )
                          return (
                            <SidebarMenuItem key={item.name}>
                              <SidebarMenuButton
                                tooltip={item.name}
                                isActive={hasActiveChild}
                                onClick={() => toggleSubMenu(item.name)}
                              >
                                <item.icon />
                                <span>{item.name}</span>
                                <RiArrowDownSLine className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''}`} />
                              </SidebarMenuButton>
                              {isSubmenuOpen && (
                                <SidebarMenuSub>
                                  {item.children.map((child) => (
                                    <SidebarMenuSubItem key={child.path}>
                                      <SidebarMenuSubButton asChild isActive={isActive(child.path)}>
                                        <NavLink to={child.path} onClick={handleNavClick}>
                                          <child.icon />
                                          <span>{child.name}</span>
                                        </NavLink>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              )}
                            </SidebarMenuItem>
                          )
                        }

                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              asChild
                              tooltip={item.name}
                              isActive={isActive(item.path)}
                            >
                              <NavLink to={item.path} end={item.path === '/'} onClick={handleNavClick}>
                                <item.icon />
                                <span>{item.name}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  )}
                </>
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
                        <NavLink to={item.path} end onClick={handleNavClick}>
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
              <DropdownMenu modal={false}>
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
                  <DropdownMenuItem onSelect={() => void logout()} className="gap-2 text-destructive focus:text-destructive">
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

      {/* ── Customize Navigation Dialog ───────────────────────────────────── */}
      <Dialog open={customizeOpen} onOpenChange={(o) => !o && setCustomizeOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Customize Navigation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Reorder sections to suit your workflow.
          </p>
          <ul className="mt-1 space-y-1">
            {draftOrder.map((id, idx) => {
              const section = ALL_SECTIONS.find((s) => s.id === id)
              if (!section) return null
              const label = section.title ?? 'Dashboard'
              const isOver = dragOver === idx
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing transition-colors select-none
                    ${isOver ? 'border-primary bg-primary/10' : 'border-border/60 bg-muted/30'}`}
                >
                  <RiDraggable className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost" size="sm" className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, -1)}
                    >
                      <RiArrowUpSLine className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-6 w-6 p-0"
                      disabled={idx === draftOrder.length - 1}
                      onClick={() => moveSection(idx, 1)}
                    >
                      <RiArrowDownSLine className="size-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={resetOrder}>
              Reset to default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={saveOrder}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AppSidebar
