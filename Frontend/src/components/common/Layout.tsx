import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      <div className="pl-0 md:pl-64 pt-20 transition-all duration-300">
        <main className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
