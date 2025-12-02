import { Bell, Search, LogOut, User, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { getInitials } from '@/utils/formatters'

const Header = () => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bg-secondary border-b border-border h-16 backdrop-blur-sm bg-opacity-95">
      <div className="flex items-center justify-between h-full px-6">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <span className="text-white font-bold text-lg">EC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Vision Optical</h1>
              <p className="text-xs text-text-tertiary">Healthcare Management</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search patients, appointments, products..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-all duration-200"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <button className="relative p-2.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-all duration-200">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-bg-secondary"></span>
          </button>

          {/* User Menu */}
          <div className="flex items-center space-x-3 ml-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
              <p className="text-xs text-text-tertiary capitalize">{user?.role}</p>
            </div>
            <div className="relative group">
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br from-blue-500 to-purple-600 hover:shadow-lg transition-all duration-200">
                {user?.name ? getInitials(user.name) : <User className="w-5 h-5" />}
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-bg-secondary rounded-xl shadow-lg border border-border py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <button className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-bg-tertiary flex items-center space-x-2 transition-colors">
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </button>
                <hr className="my-2 border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
