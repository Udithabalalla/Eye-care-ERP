import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

const Layout = () => {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <Header />
      <div className="pl-64 pt-20">
        <main className="p-8 max-w-[1600px] mx-auto animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
