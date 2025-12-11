import { axiosInstance } from './axios'

export interface User {
    user_id: string
    email: string
    name: string
    role: string
    is_active: boolean
    department?: string
    phone?: string
    avatar_url?: string
}

export const usersApi = {
    getAll: async (params?: {
        page?: number
        page_size?: number
        role?: string
    }): Promise<User[]> => {
        const response = await axiosInstance.get<User[]>('/users', { params })
        return response.data
    },
}
