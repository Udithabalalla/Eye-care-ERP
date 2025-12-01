import { axiosInstance } from './axios'
import { PaginatedResponse } from '@/types/common.types'

export interface User {
    user_id: string
    username: string
    email: string
    full_name: string
    role: string
    is_active: boolean
}

export const usersApi = {
    getAll: async (params?: {
        page?: number
        page_size?: number
        role?: string
    }): Promise<PaginatedResponse<User>> => {
        const response = await axiosInstance.get<PaginatedResponse<User>>('/users', { params })
        return response.data
    },
}
