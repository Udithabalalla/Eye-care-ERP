import { useEffect, useMemo, useState } from 'react'
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
  RiFileEditLine,
  RiBox3Line,
  RiCalendarLine,
  RiCheckDoubleLine,
  RiGlassesLine,
} from '@remixicon/react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { salesOrdersApi } from '@/api/erp.api'
import { invoicesApi } from '@/api/invoices.api'
import { dashboardApi } from '@/api/dashboard.api'
import { frameVariantsApi } from '@/api/frames.api'

type Tone = 'success' | 'danger' | 'warning' | 'info'

interface AlertItem {
  id: string
  count: number
  tone: Tone
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  cta: string
  to: string
}

const TONES: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  info: 'bg-primary/10 text-primary',
}

// What the user has already seen, so the bell only counts what's new or grown
const SEEN_KEY = 'notifications-seen'
const readSeen = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
  } catch {
    return {}
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const Header = () => {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [seen, setSeen] = useState<Record<string, number>>(readSeen)
  const [newWhileOpen, setNewWhileOpen] = useState<string[]>([])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => window.location.reload(), 150)
  }

  // Live data for the notification panel (shares caches with the pages that show the same numbers)
  const poll = { staleTime: 60_000, refetchInterval: 60_000 }
  const { data: readyData } = useQuery({
    queryKey: ['sales-orders-ready-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'ready' }),
    ...poll,
  })
  const { data: draftData } = useQuery({
    queryKey: ['sales-orders-draft-count'],
    queryFn: () => salesOrdersApi.getAll({ page: 1, page_size: 1, status: 'draft' }),
    ...poll,
  })
  const { data: overdueData } = useQuery({
    queryKey: ['invoices-overdue-count'],
    queryFn: () => invoicesApi.getAll({ page: 1, page_size: 1, payment_status: 'overdue' }),
    ...poll,
  })
  const { data: outOfStockFrames } = useQuery({
    queryKey: ['frame-variants-out-of-stock-count'],
    queryFn: () => frameVariantsApi.getAll({ page: 1, page_size: 1, out_of_stock: true }),
    ...poll,
  })
  const { data: stats, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    ...poll,
  })

  const alerts = useMemo<AlertItem[]>(() => {
    const ready = readyData?.total ?? 0
    const overdue = overdueData?.total ?? 0
    const drafts = draftData?.total ?? 0
    const lowStock = stats?.low_stock_items ?? 0
    const appointments = stats?.today_appointments ?? 0
    const framesOut = outOfStockFrames?.total ?? 0
    return [
      overdue > 0 && {
        id: 'overdue', count: overdue, tone: 'danger' as const, icon: RiReceiptLine,
        title: `${plural(overdue, 'invoice')} overdue`,
        body: 'Payment is past the due date — follow up with the patient.',
        cta: 'View invoices', to: '/invoices?status=overdue',
      },
      ready > 0 && {
        id: 'ready', count: ready, tone: 'success' as const, icon: RiShieldCheckLine,
        title: `${plural(ready, 'order')} ready for collection`,
        body: 'Let the patients know their glasses are ready.',
        cta: 'View orders', to: '/sales-orders?status=ready',
      },
      lowStock > 0 && {
        id: 'low-stock', count: lowStock, tone: 'warning' as const, icon: RiBox3Line,
        title: `${plural(lowStock, 'item')} running low`,
        body: 'Stock is at or below the minimum level.',
        cta: 'View inventory', to: '/inventory/general',
      },
      framesOut > 0 && {
        id: 'frames-out', count: framesOut, tone: 'warning' as const, icon: RiGlassesLine,
        title: `${plural(framesOut, 'frame')} out of stock`,
        body: 'They can’t be sold until they are restocked.',
        cta: 'View frames', to: '/inventory/frames',
      },
      drafts > 0 && {
        id: 'drafts', count: drafts, tone: 'info' as const, icon: RiFileEditLine,
        title: `${plural(drafts, 'draft order')} not finished`,
        body: 'Saved part-way through — complete or delete them.',
        cta: 'View drafts', to: '/sales-orders?status=draft',
      },
      appointments > 0 && {
        id: 'appointments', count: appointments, tone: 'info' as const, icon: RiCalendarLine,
        title: `${plural(appointments, 'appointment')} today`,
        body: 'Scheduled for today.',
        cta: 'View schedule', to: '/appointments',
      },
    ].filter(Boolean) as AlertItem[]
  }, [draftData, outOfStockFrames, overdueData, readyData, stats])

  const unseen = alerts.filter((a) => a.count > (seen[a.id] ?? 0))

  // Opening the panel marks everything as seen; items new at that moment keep a dot until it closes
  useEffect(() => {
    if (!notifOpen) return
    setNewWhileOpen(unseen.map((a) => a.id))
    const next = Object.fromEntries(alerts.map((a) => [a.id, a.count]))
    setSeen(next)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen])

  const openAlert = (to: string) => {
    setNotifOpen(false)
    navigate(to)
  }

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

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
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} title="Refresh page">
          <RiRefreshLine className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          onClick={toggleTheme}
          variant="ghost"
          size="icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <RiSunLine className="h-4 w-4" /> : <RiMoonLine className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={unseen.length ? `Notifications, ${unseen.length} new` : 'Notifications'}
            >
              <RiBellLine className="h-[18px] w-[18px]" />
              {unseen.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
                  {unseen.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0 shadow-lg" sideOffset={8}>
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {alerts.length ? `${plural(alerts.length, 'thing')} need${alerts.length === 1 ? 's' : ''} attention` : 'Nothing needs attention'}
                </p>
              </div>
              {alerts.length > 0 && (
                <span className="flex items-center gap-1 pt-0.5 text-[11px] text-muted-foreground">
                  <RiCheckDoubleLine className="h-3.5 w-3.5" />Marked as seen
                </span>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                    <RiCheckDoubleLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">You're all caught up</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Overdue invoices, ready orders and low stock show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {alerts.map((alert) => (
                    <li key={alert.id}>
                      <button
                        type="button"
                        onClick={() => openAlert(alert.to)}
                        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONES[alert.tone]}`}>
                          <alert.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{alert.title}</p>
                            {newWhileOpen.includes(alert.id) && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="New" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{alert.body}</p>
                          <p className="mt-1.5 flex items-center text-xs font-medium text-primary">
                            {alert.cta}
                            <RiArrowRightSLine className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                Checked every minute{updatedAt ? ` · last at ${updatedAt}` : ''}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

export default Header
