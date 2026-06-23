import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  RiBellLine,
  RiMoonLine,
  RiRefreshLine,
  RiSearchLine,
  RiSunLine,
  RiArrowRightSLine,
  RiShieldCheckLine,
  RiReceiptLine,
} from '@remixicon/react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { salesOrdersApi } from '@/api/erp.api'
import { invoicesApi } from '@/api/invoices.api'

const Header = () => {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => window.location.reload(), 150)
  }

  // Live data for notification panel
  const { data: readyData } = useQuery({
    queryKey: ['sales-orders-ready-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'ready' }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const readyCount = readyData?.total ?? 0

  const { data: overdueData } = useQuery({
    queryKey: ['invoices-overdue-count'],
    queryFn: () => invoicesApi.getAll({ page: 1, page_size: 1, payment_status: 'overdue' }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const overdueCount = overdueData?.total ?? 0

  const totalAlerts = readyCount + overdueCount

  const notifications = [
    ...(readyCount > 0
      ? [{
          id: 'ready',
          icon: RiShieldCheckLine,
          iconClass: 'text-green-600 dark:text-green-400',
          bgClass: 'bg-green-50 dark:bg-green-950/30',
          title: `${readyCount} order${readyCount !== 1 ? 's' : ''} ready for collection`,
          body: 'Patients are waiting for their orders.',
          action: () => { navigate('/sales-orders?status=ready'); setNotifOpen(false) },
        }]
      : []),
    ...(overdueCount > 0
      ? [{
          id: 'overdue',
          icon: RiReceiptLine,
          iconClass: 'text-destructive',
          bgClass: 'bg-destructive/5',
          title: `${overdueCount} overdue invoice${overdueCount !== 1 ? 's' : ''}`,
          body: 'Payments are past the due date.',
          action: () => { navigate('/invoices?status=overdue'); setNotifOpen(false) },
        }]
      : []),
  ]

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-md px-4 md:px-6">
      {/* Left */}
      <div className="flex items-center gap-2 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-5 hidden md:block" />
        <div className="relative group w-full max-w-sm hidden sm:block">
          <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            className="h-9 rounded-md border-border bg-card pl-9 text-sm"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh page"
        >
          <RiRefreshLine className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>

        {/* Theme toggle */}
        <Button
          onClick={toggleTheme}
          variant="ghost"
          size="icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <RiSunLine className="h-4 w-4" />
          ) : (
            <RiMoonLine className="h-4 w-4" />
          )}
        </Button>

        {/* Notifications */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <RiBellLine className="h-4 w-4" />
              {totalAlerts > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 p-0 shadow-lg" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {totalAlerts > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Body */}
            <div className="divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <RiBellLine className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">All clear</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">No pending actions right now.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <button
                      key={n.id}
                      onClick={n.action}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${n.bgClass}`}>
                        <Icon className={`h-4 w-4 ${n.iconClass}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      </div>
                      <RiArrowRightSLine className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">Updates every 60 seconds · Based on live data</p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

export default Header
