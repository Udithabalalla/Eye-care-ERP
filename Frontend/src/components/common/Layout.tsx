import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

const Layout = () => {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="min-h-screen bg-bg-secondary">
        <Header />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
