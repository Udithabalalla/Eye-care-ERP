import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useReservedSheetWidth } from '@/store/sheetLayoutStore'

const Layout = () => {
  const reservedSheetWidth = useReservedSheetWidth()

  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>
        <Header />
        <main
          className="flex-1 p-4 md:p-8 animate-fade-in-up transition-[margin-right] duration-200 ease-in-out"
          style={{ marginRight: reservedSheetWidth }}
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
