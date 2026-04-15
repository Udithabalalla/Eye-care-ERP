import { axiosInstance } from './axios'

export interface Permission {
  permission_id: string
  name: string
  description?: string
  category: string
  code: string
  created_at: string
  updated_at?: string
}

export interface Role {
  role_id: string
  name: string
  description?: string
  permission_ids: string[]
  permissions?: Permission[]
  is_system_role: boolean
  is_active: boolean
  created_at: string
  updated_at?: string
}

export const rolesAndPermissionsApi = {
  // Permissions
  listPermissions: async (category?: string, page = 1, pageSize = 100) => {
    const params = new URLSearchParams()
    if (category) params.append('category', category)
    params.append('skip', String((page - 1) * pageSize))
    params.append('limit', String(pageSize))
    const res = await axiosInstance.get(`/roles/permissions?${params}`)
    return res.data
  },

  getPermission: async (id: string) => {
    const res = await axiosInstance.get(`/roles/permissions/${id}`)
    return res.data.data
  },

  createPermission: async (data: { name: string; category: string; code: string; description?: string }) => {
    const res = await axiosInstance.post('/roles/permissions', data)
    return res.data.data
  },

  updatePermission: async (id: string, data: { name?: string; category?: string; description?: string }) => {
    const res = await axiosInstance.put(`/roles/permissions/${id}`, data)
    return res.data.data
  },

  deletePermission: async (id: string) => {
    const res = await axiosInstance.delete(`/roles/permissions/${id}`)
    return res.data
  },

  // Roles
  listRoles: async (page = 1, pageSize = 100, includeInactive = false) => {
    const params = new URLSearchParams()
    params.append('skip', String((page - 1) * pageSize))
    params.append('limit', String(pageSize))
    if (includeInactive) params.append('include_inactive', 'true')
    const res = await axiosInstance.get(`/roles/roles?${params}`)
    return res.data
  },

  getRole: async (id: string) => {
    const res = await axiosInstance.get(`/roles/roles/${id}`)
    return res.data.data
  },

  createRole: async (data: { name: string; description?: string; permission_ids?: string[] }) => {
    const res = await axiosInstance.post('/roles/roles', data)
    return res.data.data
  },

  updateRole: async (id: string, data: { name?: string; description?: string; permission_ids?: string[]; is_active?: boolean }) => {
    const res = await axiosInstance.put(`/roles/roles/${id}`, data)
    return res.data.data
  },

  addPermissionToRole: async (roleId: string, permissionId: string) => {
    const res = await axiosInstance.post(`/roles/roles/${roleId}/permissions/${permissionId}`)
    return res.data.data
  },

  removePermissionFromRole: async (roleId: string, permissionId: string) => {
    const res = await axiosInstance.delete(`/roles/roles/${roleId}/permissions/${permissionId}`)
    return res.data.data
  },

  deleteRole: async (id: string) => {
    const res = await axiosInstance.delete(`/roles/roles/${id}`)
    return res.data
  },
}
