import {
  RiBellLine,
  RiMoonLine,
  RiSearchLine,
  RiSunLine,
} from '@remixicon/react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const Header = () => {
  const { theme, toggleTheme } = useTheme()

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

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <RiBellLine className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </Button>
      </div>
    </header>
  )
}

export default Header
