import { axiosInstance } from './axios'
import {
  LoginRequest,
  LoginResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  SignupRequest,
  User,
} from '@/types/auth.types'
import { ApiResponse } from '@/types/common.types'

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  signup: async (data: SignupRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/register', data)
    return response.data
  },

  requestPasswordReset: async (data: PasswordResetRequest): Promise<PasswordResetResponse> => {
    const response = await axiosInstance.post<PasswordResetResponse>('/auth/password-reset/request', data)
    return response.data
  },

  confirmPasswordReset: async (data: PasswordResetConfirmRequest): Promise<PasswordResetResponse> => {
    const response = await axiosInstance.post<PasswordResetResponse>('/auth/password-reset/confirm', data)
    return response.data
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout')
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await axiosInstance.get<ApiResponse<User>>('/auth/me')
    return response.data.data
  },
}
