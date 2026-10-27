import { Link } from 'react-router-dom'
import { RiArrowRightSLine } from '@remixicon/react'
import { SETTINGS_GROUPS } from '@/components/settings/settingsNav'

const SettingsHub = () => (
  <div className="mx-auto max-w-5xl space-y-10">
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Set up the lists your team works from, and manage who can use the system.
      </p>
    </section>

    {SETTINGS_GROUPS.map((group) => (
      <section key={group.id} aria-labelledby={`settings-${group.id}`} className="space-y-4">
        <div>
          <h2 id={`settings-${group.id}`} className="text-base font-semibold text-foreground">{group.title}</h2>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
        <ul className="stagger grid gap-3 sm:grid-cols-2">
          {group.items.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="group flex h-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
                </span>
                <RiArrowRightSLine className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
)

export default SettingsHub
