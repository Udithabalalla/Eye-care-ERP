import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useReservedSheetWidth } from '@/store/sheetLayoutStore'

const Layout = () => {
  const reservedSheetWidth = useReservedSheetWidth()
  const { pathname } = useLocation()

  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>
        <Header />
        <main
          className="flex-1 p-4 md:p-8 transition-[margin-right] duration-200 ease-in-out"
          style={{ marginRight: reservedSheetWidth }}
        >
          {/* Keyed by page so each navigation eases in; filters and tabs (query string) don't replay it */}
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
