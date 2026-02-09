import { Bell, Search, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

const Header = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-64 z-40 bg-bg-primary/80 backdrop-blur-md h-20 transition-all duration-300">
      <div className="flex items-center justify-between h-full px-8">
        {/* Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl py-3 pl-12 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-3 text-text-secondary hover:text-primary hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all duration-200 shadow-sm"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <button className="relative p-3 text-text-secondary hover:text-primary hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all duration-200 shadow-sm">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
