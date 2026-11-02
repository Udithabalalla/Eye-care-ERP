import { axiosInstance } from './axios'
import {
  LoginRequest,
  LoginResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  SignupRequest,
  SignupStarted,
  User,
} from '@/types/auth.types'
import { ApiResponse } from '@/types/common.types'

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  signup: async (data: SignupRequest): Promise<SignupStarted> => {
    const response = await axiosInstance.post<SignupStarted>('/auth/register', data)
    return response.data
  },

  verifySignup: async (email: string, otp: string): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/register/verify', { email, otp })
    return response.data
  },

  requestPasswordReset: async (data: PasswordResetRequest): Promise<PasswordResetResponse> => {
    const response = await axiosInstance.post<PasswordResetResponse>(
      '/auth/password-reset/request',
      data,
      { timeout: 45000 }
    )
    return response.data
  },

  confirmPasswordReset: async (data: PasswordResetConfirmRequest): Promise<PasswordResetResponse> => {
    const response = await axiosInstance.post<PasswordResetResponse>('/auth/password-reset/confirm', data)
    return response.data
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout', { refresh_token: localStorage.getItem('refresh_token') })
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<User> => {
    const response = await axiosInstance.post<ApiResponse<User>>('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    })
    return response.data.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await axiosInstance.get<ApiResponse<User>>('/auth/me')
    return response.data.data
  },
}
