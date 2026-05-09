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
    last_login?: string
    created_at?: string
    updated_at?: string
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

    listUsers: async (page = 1, pageSize = 100, role?: string) => {
        const params = new URLSearchParams()
        params.append('skip', String((page - 1) * pageSize))
        params.append('limit', String(pageSize))
        if (role) params.append('role', role)
        const res = await axiosInstance.get(`/users?${params}`)
        return res.data
    },

    getUser: async (id: string) => {
        const res = await axiosInstance.get(`/users/${id}`)
        return res.data.data
    },

    createUser: async (data: { email: string; password: string; name: string; role: string; department?: string; phone?: string }) => {
        const res = await axiosInstance.post('/users', data)
        return res.data.data
    },

    updateUser: async (id: string, data: { email?: string; name?: string; role?: string; department?: string; phone?: string }) => {
        const res = await axiosInstance.put(`/users/${id}`, data)
        return res.data.data
    },

    changePassword: async (id: string, oldPassword: string, newPassword: string) => {
        const res = await axiosInstance.post(`/users/${id}/change-password`, {
            old_password: oldPassword,
            new_password: newPassword,
        })
        return res.data
    },

    resetPassword: async (id: string, newPassword: string) => {
        const params = new URLSearchParams()
        params.append('new_password', newPassword)
        const res = await axiosInstance.post(`/users/${id}/reset-password?${params}`)
        return res.data
    },

    deactivateUser: async (id: string) => {
        const res = await axiosInstance.post(`/users/${id}/deactivate`)
        return res.data
    },

    activateUser: async (id: string) => {
        const res = await axiosInstance.post(`/users/${id}/activate`)
        return res.data
    },
}
