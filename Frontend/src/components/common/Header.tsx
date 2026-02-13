import { Bell01, SearchLg, Moon01, Sun } from '@untitledui/icons'
import { useTheme } from '@/contexts/ThemeContext'

const Header = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-64 z-40 bg-primary/80 backdrop-blur-md h-20 transition-all duration-300">
      <div className="flex items-center justify-between h-full px-8">
        {/* Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative group">
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
