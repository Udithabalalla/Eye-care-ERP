import { Bell01, SearchLg, Moon01, Sun, Menu01 } from '@untitledui/icons'
import { useTheme } from '@/contexts/ThemeContext'

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-primary/80 backdrop-blur-md h-20 transition-all duration-300 border-b border-secondary md:border-none">
      <div className="flex items-center justify-between h-full px-4 md:px-8">
        {/* Left Section - Mobile Menu & Search */}
        <div className="flex items-center flex-1 max-w-xl gap-2 md:gap-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 text-secondary hover:text-brand-600 rounded-xl transition-all"
            aria-label="Open menu"
          >
            <Menu01 className="w-6 h-6" />
          </button>

          <div className="relative group w-full hidden sm:block">
            <SearchLg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-tertiary group-focus-within:text-brand-600 transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-primary border border-secondary rounded-2xl py-3 pl-12 pr-4 text-sm text-primary placeholder-tertiary focus:ring-2 focus:ring-brand-500/20 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-3 text-secondary hover:text-brand-600 hover:bg-secondary rounded-xl transition-all duration-200 shadow-sm"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon01 className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <button className="relative p-3 text-secondary hover:text-brand-600 hover:bg-secondary rounded-xl transition-all duration-200 shadow-sm">
            <Bell01 className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-error-500 rounded-full ring-2 ring-primary"></span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
