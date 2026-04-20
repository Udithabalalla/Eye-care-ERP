import { Bell, Menu, Moon, Search, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-0 z-40 h-20 border-b border-border bg-background/90 backdrop-blur-md transition-all duration-300 md:left-64 md:border-none">
      <div className="flex items-center justify-between h-full px-4 md:px-8">
        {/* Left Section - Mobile Menu & Search */}
        <div className="flex items-center flex-1 max-w-xl gap-2 md:gap-0">
          <Button
            onClick={onMenuClick}
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative group w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              className="h-9 rounded-xl border-border bg-background pl-9"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Dark Mode Toggle */}
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
