import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore()
  
  // Double-check token exists in localStorage to prevent stale auth state
  const token = localStorage.getItem('token')

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
