import { useAuthStore } from '@/store/authStore'

export const useAuth = () => {
  const { user, isAuthenticated, login, logout } = useAuthStore()

  return {
    user,
    isAuthenticated,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isDoctor: user?.role === 'doctor' || user?.role === 'optometrist',
    isStaff: user?.role === 'staff' || user?.role === 'receptionist',
  }
}
