import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { SETTINGS_HOME } from '@/components/settings/settingsNav'

// Admin screens: the API enforces this too, this just keeps others off pages they can't use
const AdminRoute = () => {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to={SETTINGS_HOME} replace />
}

export default AdminRoute
