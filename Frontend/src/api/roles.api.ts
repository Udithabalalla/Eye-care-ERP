import { axiosInstance } from './axios'

/** One area of the system and the actions that can be granted in it */
export interface PermissionModule {
  module: string
  label: string
  description: string
  actions: PermissionAction[]
}

export type PermissionAction = 'read' | 'write' | 'delete'

export interface Role {
  role_id: string
  name: string
  description?: string
  /** Permission codes like `patients.read`; `['*']` for admin */
  permission_ids: string[]
  is_system_role: boolean
  is_active: boolean
  /** Admin always has every permission and can't be edited */
  editable: boolean
  matches_defaults: boolean
  user_count: number
  created_at?: string
  updated_at?: string
  updated_by?: string
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'View',
  write: 'Add & edit',
  delete: 'Delete',
}

export const rolesAndPermissionsApi = {
  listPermissionModules: async (): Promise<PermissionModule[]> => {
    const res = await axiosInstance.get('/roles/permissions/modules')
    return res.data.data
  },

  listRoles: async (): Promise<Role[]> => {
    const res = await axiosInstance.get('/roles/roles')
    return res.data.data
  },

  getRole: async (id: string): Promise<Role> => {
    const res = await axiosInstance.get(`/roles/roles/${id}`)
    return res.data.data
  },

  updateRole: async (id: string, data: { description?: string; permission_ids?: string[] }): Promise<Role> => {
    const res = await axiosInstance.put(`/roles/roles/${id}`, data)
    return res.data.data
  },

  resetRole: async (id: string): Promise<Role> => {
    const res = await axiosInstance.post(`/roles/roles/${id}/reset`)
    return res.data.data
  },
}
