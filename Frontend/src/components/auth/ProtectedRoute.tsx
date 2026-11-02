import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { PASSWORD_CHANGE_REQUIRED_EVENT } from '@/api/axios'
import ForcePasswordChange from './ForcePasswordChange'

const ProtectedRoute = () => {
  const { isAuthenticated, user, setUser } = useAuthStore()

  // The API can also say a password change is due (e.g. an admin reset it)
  useEffect(() => {
    const onPasswordChangeRequired = () => {
      const current = useAuthStore.getState().user
      if (current && !current.must_change_password) setUser({ ...current, must_change_password: true })
    }
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired)
    return () => window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired)
  }, [setUser])

  // Double-check token exists in localStorage to prevent stale auth state
  const token = localStorage.getItem('token')

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  if (user?.must_change_password) {
    return <ForcePasswordChange />
  }

  return <Outlet />
}

export default ProtectedRoute
