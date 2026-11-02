import { axiosInstance } from './axios'
import { ApiResponse } from '@/types/common.types'

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
    must_change_password?: boolean
}

/** What admins get back: the account plus its own permission changes and live sessions */
export interface AdminUser extends User {
    granted_permissions: string[]
    revoked_permissions: string[]
    active_sessions: number
}

export interface UserPermissions {
    user_id: string
    role: string
    role_permissions: string[]
    granted: string[]
    revoked: string[]
    effective: string[]
}

export interface CreateUserInput {
    email: string
    password: string
    name: string
    role: string
    department?: string
    phone?: string
    must_change_password?: boolean
}

export interface UpdateUserInput {
    email?: string
    name?: string
    role?: string
    department?: string
    phone?: string
}

export const usersApi = {
    getAll: async (params?: {
        page?: number
        page_size?: number
        role?: string
    }): Promise<User[]> => {
        const response = await axiosInstance.get<ApiResponse<User[]>>('/users', { params })
        return response.data.data ?? []
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

    createUser: async (data: CreateUserInput): Promise<AdminUser> => {
        const res = await axiosInstance.post('/users', data)
        return res.data.data
    },

    updateUser: async (id: string, data: UpdateUserInput): Promise<AdminUser> => {
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

    resetPassword: async (id: string, newPassword: string, mustChangePassword = true) => {
        const res = await axiosInstance.post(`/users/${id}/reset-password`, {
            new_password: newPassword,
            must_change_password: mustChangePassword,
        })
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

    getPermissions: async (id: string): Promise<UserPermissions> => {
        const res = await axiosInstance.get(`/users/${id}/permissions`)
        return res.data.data
    },

    setPermissions: async (id: string, data: { granted: string[]; revoked: string[] }): Promise<UserPermissions> => {
        const res = await axiosInstance.put(`/users/${id}/permissions`, data)
        return res.data.data
    },

    signOutEverywhere: async (id: string): Promise<{ revoked: number }> => {
        const res = await axiosInstance.post(`/users/${id}/sessions/revoke`)
        return res.data.data
    },
}
