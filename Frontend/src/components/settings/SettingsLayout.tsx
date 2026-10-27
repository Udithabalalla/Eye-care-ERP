import { Fragment, Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { RiArrowLeftSLine } from '@remixicon/react'
import { cn } from '@/lib/utils'
import Loading from '@/components/common/Loading'
import { SETTINGS_GROUPS, SETTINGS_HOME } from './settingsNav'

// Wraps every set-up screen with a grouped menu so people can move between them
// without going back through the app sidebar
const SettingsLayout = () => (
  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
    {/* Wide screens: a vertical menu beside the page */}
    <aside className="hidden xl:sticky xl:top-20 xl:block xl:w-60 xl:shrink-0">
      <Link
        to={SETTINGS_HOME}
        className="mb-4 inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <RiArrowLeftSLine className="size-4" />
        All settings
      </Link>
      <nav aria-label="Settings" className="space-y-6">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>

    {/* Narrower screens: the same menu as a scrollable strip above the page */}
    <nav aria-label="Settings" className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 pb-3 md:-mx-8 md:px-8 xl:hidden">
      <Link
        to={SETTINGS_HOME}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md pr-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <RiArrowLeftSLine className="size-4" />
        Settings
      </Link>
      {SETTINGS_GROUPS.map((group) => (
        <Fragment key={group.id}>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          {group.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                )
              }
            >
              <item.icon className="size-4" />
              {item.name}
            </NavLink>
          ))}
        </Fragment>
      ))}
    </nav>

    <div className="min-w-0 flex-1">
      {/* Keeps the menu on screen while the next settings page loads */}
      <Suspense fallback={<div className="py-16"><Loading text="Loading..." /></div>}>
        <Outlet />
      </Suspense>
    </div>
  </div>
)

export default SettingsLayout
