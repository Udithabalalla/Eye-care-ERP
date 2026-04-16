import { Bell01, SearchLg } from '@untitledui/icons'
import { SidebarTrigger } from '@/components/ui/sidebar'

const Header = () => {
  return (
    <header className="z-20 h-12 border-b bg-background">
      <div className="flex h-full items-center justify-between px-4 md:px-8">
        <div className="flex flex-1 items-center gap-2 md:gap-0">
          <SidebarTrigger className="mr-2 md:hidden" />

          <div className="group relative hidden w-full max-w-xl sm:block">
            <SearchLg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="text"
              placeholder="Search records, invoices, or patients"
              className="h-8 w-full rounded-md border bg-background py-1.5 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="relative rounded-md p-2 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground">
            <Bell01 className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
