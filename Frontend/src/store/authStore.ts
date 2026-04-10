import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/auth.api'
import {
  AuthState,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SignupRequest,
} from '@/types/auth.types'
import toast from 'react-hot-toast'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login(credentials)
          
          // Store token in localStorage
          localStorage.setItem('token', response.access_token)
          localStorage.setItem('user', JSON.stringify(response.user))
          
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
          
          toast.success(`Welcome back, ${response.user.name}!`)
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Login failed')
          throw error
        }
      },

      signup: async (data: SignupRequest) => {
        set({ isLoading: true })
        try {
          const response = await authApi.signup(data)

          localStorage.setItem('token', response.access_token)
          localStorage.setItem('user', JSON.stringify(response.user))

          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })

          toast.success(`Welcome, ${response.user.name}!`)
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Registration failed')
          throw error
        }
      },

      requestPasswordReset: async (data: PasswordResetRequest) => {
        set({ isLoading: true })
        try {
          const response = await authApi.requestPasswordReset(data)
          set({ isLoading: false })
          toast.success(response.message)
          return response
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Unable to send reset OTP')
          throw error
        }
      },

      confirmPasswordReset: async (data: PasswordResetConfirmRequest) => {
        set({ isLoading: true })
        try {
          const response = await authApi.confirmPasswordReset(data)
          set({ isLoading: false })
          toast.success(response.message)
          return response
        } catch (error: any) {
          set({ isLoading: false })
          toast.error(error.response?.data?.message || 'Password reset failed')
          throw error
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          toast.success('Logged out successfully')
        }
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
