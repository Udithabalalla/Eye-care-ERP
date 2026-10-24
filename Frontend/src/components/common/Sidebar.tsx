import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  RiArrowRightSLine,

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
  RiAddLine,
  RiStethoscopeLine,
  RiLayoutGridLine,
} from '@remixicon/react'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/formatters'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import BrandLogo from '@/components/common/BrandLogo'
import { salesOrdersApi } from '@/api/erp.api'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  id: string
  title?: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

// Most-used areas first; users can reorder sections from the account menu
const ALL_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    icon: RiHomeLine,
    items: [{ name: 'Dashboard', path: '/', icon: RiHomeLine }],
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: RiReceiptLine,
    items: [
      { name: 'Sales Orders', path: '/sales-orders', icon: RiReceiptLine },
      { name: 'Invoices', path: '/invoices', icon: RiFileChartLine },
      { name: 'Payments', path: '/payments', icon: RiMoneyDollarCircleLine },
      { name: 'Refunds', path: '/refunds', icon: RiRefundLine },
    ],
  },
  {
    id: 'clinical',
    title: 'Patients & Clinic',
    icon: RiStethoscopeLine,
    items: [
      { name: 'Patients', path: '/patients', icon: RiUserLine },
      { name: 'Appointments', path: '/appointments', icon: RiCalendarLine },
      { name: 'Prescriptions', path: '/prescriptions', icon: RiEyeLine },
      { name: 'Doctors', path: '/doctors', icon: RiUserFollowLine },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: RiBox3Line,
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
    icon: RiTruckLine,
    items: [
      { name: 'Suppliers', path: '/suppliers', icon: RiBuilding2Line },
      { name: 'Purchase Orders', path: '/purchase-orders', icon: RiShoppingCartLine },
      { name: 'Stock Receipts', path: '/stock-receipts', icon: RiInboxLine },
      { name: 'Supplier Invoices', path: '/supplier-invoices', icon: RiFileTextLine },
      { name: 'Supplier Payments', path: '/supplier-payments', icon: RiBankCardLine },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: RiWallet3Line,
    items: [
      { name: 'Transactions', path: '/transactions', icon: RiExchangeDollarLine },
      { name: 'Ledger', path: '/ledger', icon: RiBookOpenLine },
      { name: 'Reports', path: '/reports', icon: RiBarChartLine },
    ],
  },
  {
    id: 'basic-data',
    title: 'Master Data',
    icon: RiLayoutGridLine,
    items: [
      { name: 'Lenses', path: '/basic-data/lenses', icon: RiEyeLine },
      { name: 'Product Categories', path: '/basic-data/product-categories', icon: RiPriceTag3Line },
      { name: 'Charge Types', path: '/basic-data/other-expenses', icon: RiWallet3Line },
      { name: 'Price Rules', path: '/basic-data/complimentary-items', icon: RiPercentLine },
    ],
  },
  {
    id: 'system',
    title: 'Administration',
    icon: RiSettings4Line,
    items: [
      { name: 'Users', path: '/users', icon: RiTeamLine },
      { name: 'Roles & Permissions', path: '/roles-permissions', icon: RiShieldCheckLine },
      { name: 'Activity Logs', path: '/activity-logs', icon: RiHistoryLine },
      { name: 'Company Profile', path: '/settings', icon: RiSettings4Line },
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

const matchesPath = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)

// Active entries use the brand colour so "where am I" is obvious at a glance
const ACTIVE_ITEM = 'data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-medium data-[active=true]:text-sidebar-primary [&>svg]:data-[active=true]:text-sidebar-primary'

const AppSidebar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  const [sectionOrder, setSectionOrder] = useState<string[]>(getSavedOrder)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])

  // Orders waiting for collection — shared cache with the header notifications
  const { data: readyData } = useQuery({
    queryKey: ['sales-orders-ready-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'ready' }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const readyCount = readyData?.total ?? 0

  const isActive = useCallback((path: string) => matchesPath(location.pathname, path), [location.pathname])

  // The section holding the current page starts (and stays) open
  const activeSectionId = useMemo(
    () => ALL_SECTIONS.find((s) => s.title && s.items.some((item) => isActive(item.path)))?.id ?? null,
    [isActive],
  )

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeSectionId ? { [activeSectionId]: true } : {},
  )

  useEffect(() => {
    if (activeSectionId) {
      setOpenGroups((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }))
    }
  }, [activeSectionId])

  const handleNavClick = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  const orderedSections = sectionOrder
    .map((id) => ALL_SECTIONS.find((s) => s.id === id))
    .filter(Boolean) as NavSection[]

  const badgeFor = (path: string) => (path === '/sales-orders' && readyCount > 0 ? readyCount : 0)

  // ── Customize dialog helpers ─────────────────────────────────────────────
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

  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''

  return (
    <>
      <ShadcnSidebar collapsible="icon">
        {/* Brand + primary action */}
        <SidebarHeader className="gap-3 px-3 pt-4">
          <NavLink to="/" onClick={handleNavClick} className="flex items-center gap-2.5 rounded-md px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <BrandLogo className="h-7 w-10 text-sidebar-primary group-data-[collapsible=icon]:w-8" />
            <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">Vision Opticals</span>
              <span className="truncate text-[11px] text-muted-foreground">Eye Care ERP</span>
            </div>
          </NavLink>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="New sales order"
                className="h-9 justify-center bg-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <NavLink to="/sales-orders/assistant" onClick={handleNavClick}>
                  <RiAddLine />
                  <span>New sales order</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator className="mx-3" />

        {/* Navigation */}
        <SidebarContent>
          <SidebarGroup className="px-2">
            <SidebarMenu className="gap-0.5">
              {orderedSections.map((section) => {
                // Dashboard: a single link
                if (!section.title) {
                  return section.items.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild tooltip={item.name} isActive={isActive(item.path)} className={`h-9 text-sm ${ACTIVE_ITEM}`}>
                        <NavLink to={item.path} end onClick={handleNavClick}>
                          <item.icon />
                          <span>{item.name}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                }

                const sectionActive = section.id === activeSectionId
                const sectionBadge = section.items.reduce((n, item) => n + badgeFor(item.path), 0)

                // Icon-only sidebar: each section opens a flyout menu
                if (isCollapsed) {
                  return (
                    <SidebarMenuItem key={section.id}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton tooltip={section.title} isActive={sectionActive} className={`h-9 ${ACTIVE_ITEM}`}>
                            <section.icon />
                            <span>{section.title}</span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="w-52">
                          <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
                          {section.items.map((item) => (
                            <DropdownMenuItem key={item.path} asChild className={`gap-2.5 ${isActive(item.path) ? 'font-medium text-primary' : ''}`}>
                              <NavLink to={item.path}>
                                <item.icon className="h-4 w-4" />
                                <span className="flex-1">{item.name}</span>
                                {badgeFor(item.path) > 0 && <span className="text-xs text-primary">{badgeFor(item.path)}</span>}
                              </NavLink>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                }

                const isOpen = !!openGroups[section.id]
                return (
                  <Collapsible
                    key={section.id}
                    open={isOpen}
                    onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [section.id]: open }))}
                    asChild
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={section.title}
                          className={`h-9 text-sm ${sectionActive ? 'font-medium text-sidebar-foreground' : 'text-sidebar-foreground/80'}`}
                        >
                          <section.icon className={sectionActive ? 'text-sidebar-primary' : ''} />
                          <span>{section.title}</span>
                          {!isOpen && sectionBadge > 0 && (
                            <span className="ml-auto rounded-full bg-sidebar-primary/10 px-1.5 text-[11px] font-semibold text-sidebar-primary">
                              {sectionBadge}
                            </span>
                          )}
                          <RiArrowRightSLine className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${!isOpen && sectionBadge > 0 ? '' : 'ml-auto'} ${isOpen ? 'rotate-90' : ''}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="mr-0 gap-0.5 py-1">
                          {section.items.map((item) => (
                            <SidebarMenuSubItem key={item.path}>
                              <SidebarMenuSubButton asChild isActive={isActive(item.path)} className={`h-8 text-[13px] ${ACTIVE_ITEM}`}>
                                <NavLink to={item.path} onClick={handleNavClick}>
                                  <span className="flex-1 truncate">{item.name}</span>
                                  {badgeFor(item.path) > 0 && (
                                    <span
                                      className="ml-auto rounded-full bg-sidebar-primary/10 px-1.5 text-[11px] font-semibold text-sidebar-primary"
                                      title={`${badgeFor(item.path)} ready for collection`}
                                    >
                                      {badgeFor(item.path)}
                                    </span>
                                  )}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* Account */}
        <SidebarFooter className="border-t border-sidebar-border">
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
                      <span className="truncate text-xs text-muted-foreground">{roleLabel || user?.email || ''}</span>
                    </div>
                    <RiArrowUpDownLine className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60 rounded-lg" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={6}>
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{user?.name || 'User'}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/settings')} className="gap-2">
                    <RiSettings4Line className="h-4 w-4" />
                    Company profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openCustomize} className="gap-2">
                    <RiListSettingsLine className="h-4 w-4" />
                    Reorder menu sections
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
            <DialogTitle>Reorder menu sections</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Drag sections, or use the arrows, to put the ones you use most at the top.
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
                  <section.icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost" size="sm" className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, -1)}
                      aria-label={`Move ${label} up`}
                    >
                      <RiArrowUpSLine className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-6 w-6 p-0"
                      disabled={idx === draftOrder.length - 1}
                      onClick={() => moveSection(idx, 1)}
                      aria-label={`Move ${label} down`}
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
