import { axiosInstance } from './axios'
import { LoginRequest, LoginResponse, User } from '@/types/auth.types'
import { ApiResponse } from '@/types/common.types'

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials)
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
