import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash02, Edit02, SearchLg } from '@untitledui/icons'
import { Table, TableCard, Input } from '@/components/ui'
import Button from '@/components/common/Button'
import Loading from '@/components/common/Loading'
import Modal from '@/components/common/Modal'
import toast from 'react-hot-toast'
import { rolesAndPermissionsApi } from '@/api/roles.api'
import type { Role, Permission } from '@/api/roles.api'


const RolesPermissions = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles')
  const [formData, setFormData] = useState({ name: '', description: '', permission_ids: [] as string[] })

  // Roles Query
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesAndPermissionsApi.listRoles(),
  })

  // Permissions Query
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesAndPermissionsApi.listPermissions(),
  })

  // Create/Update Role Mutation
  const rolesMutation = useMutation({
    mutationFn: (data: any) =>
      selectedRole
        ? rolesAndPermissionsApi.updateRole(selectedRole.role_id, data)
        : rolesAndPermissionsApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsRoleModalOpen(false)
      setSelectedRole(null)
      setFormData({ name: '', description: '', permission_ids: [] })
      toast.success(selectedRole ? 'Role updated' : 'Role created')
    },
    onError: () => toast.error('Failed to save role'),
  })

  // Delete Role Mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => rolesAndPermissionsApi.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
    },
    onError: () => toast.error('Failed to delete role'),
  })

  // Create Permission Mutation
  const permissionMutation = useMutation({
    mutationFn: (data: any) => rolesAndPermissionsApi.createPermission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setIsPermissionModalOpen(false)
      setFormData({ name: '', description: '', permission_ids: [] })
      toast.success('Permission created')
    },
    onError: () => toast.error('Failed to create permission'),
  })

  const handleSaveRole = () => {
    if (!formData.name) {
      toast.error('Role name is required')
      return
    }
    rolesMutation.mutate({ name: formData.name, description: formData.description, permission_ids: formData.permission_ids })
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setFormData({ name: role.name, description: role.description || '', permission_ids: role.permission_ids })
    setIsRoleModalOpen(true)
  }

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteRoleMutation.mutate(roleId)
    }
  }

  const rolesDisplay = (rolesData?.data || []).filter((role: Role) => {
    const query = search.toLowerCase()
    return role.name.toLowerCase().includes(query) || (role.description?.toLowerCase().includes(query) ?? false)
  })

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border/80">
        <button
          onClick={() => setActiveTab('roles')}
          className={`rounded-t-apple px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'roles'
              ? 'border-b-2 border-brand-600 text-primary'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`rounded-t-apple px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'permissions'
              ? 'border-b-2 border-brand-600 text-primary'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Permissions
        </button>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <TableCard.Root>
            <TableCard.Header
              title="Roles"
              badge={rolesDisplay.length}
              description="Manage system roles and permissions"
              contentTrailing={(
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Input
                    placeholder="Search roles..."
                    value={search}
                    onChange={setSearch}
                    iconLeading={SearchLg}
                    className="w-full sm:w-72"
                  />
                  <Button
                    onClick={() => {
                      setSelectedRole(null)
                      setFormData({ name: '', description: '', permission_ids: [] })
                      setIsRoleModalOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                  </Button>
                </div>
              )}
            />
            {rolesLoading ? (
              <div className="p-8">
                <Loading />
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Head label="Role Name" isRowHeader />
                  <Table.Head label="Description" />
                  <Table.Head label="Permissions" />
                  <Table.Head label="Status" />
                  <Table.Head label="Actions" />
                </Table.Header>
                <Table.Body>
                  {rolesDisplay.map((role: Role) => (
                    <Table.Row key={role.role_id}>
                      <Table.Cell>
                        <span className="font-medium text-primary">{role.name}</span>
                      </Table.Cell>
                      <Table.Cell>{role.description || '-'}</Table.Cell>
                      <Table.Cell>
                        <span className="inline-flex items-center rounded-pill border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                          {role.permission_ids.length} permissions
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ${
                          role.is_active
                            ? 'bg-success-500/15 text-success-700 dark:text-success-300'
                            : 'bg-error-500/15 text-error-700 dark:text-error-300'
                        }`}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditRole(role)}
                            className="rounded-lg p-2 text-secondary transition-colors hover:bg-secondary hover:text-primary"
                            title="Edit"
                          >
                            <Edit02 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.role_id)}
                            className="rounded-lg p-2 text-error-600 transition-colors hover:bg-error-500/15 dark:text-error-300"
                            title="Delete"
                          >
                            <Trash02 className="w-4 h-4" />
                          </button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </TableCard.Root>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <TableCard.Root>
            <TableCard.Header
              title="Permissions"
              badge={(permissionsData?.data || []).length}
              description="System permissions and access controls"
              contentTrailing={
                <Button onClick={() => setIsPermissionModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Permission
                </Button>
              }
            />
            {permissionsLoading ? (
              <div className="p-8">
                <Loading />
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Head label="Permission" isRowHeader />
                  <Table.Head label="Code" />
                  <Table.Head label="Category" />
                  <Table.Head label="Description" />
                </Table.Header>
                <Table.Body>
                  {(permissionsData?.data || []).map((perm: Permission) => (
                    <Table.Row key={perm.permission_id}>
                      <Table.Cell>
                        <span className="font-medium text-primary">{perm.name}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <code className="rounded-md border border-border/70 bg-surface-secondary px-2 py-1 text-sm text-primary">{perm.code}</code>
                      </Table.Cell>
                      <Table.Cell>{perm.category}</Table.Cell>
                      <Table.Cell>{perm.description || '-'}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </TableCard.Root>
        </div>
      )}

      {/* Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false)
          setSelectedRole(null)
          setFormData({ name: '', description: '', permission_ids: [] })
        }}
        title={selectedRole ? 'Edit Role' : 'Create Role'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Role Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              placeholder="Role description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Permissions</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(permissionsData?.data || []).map((perm: Permission) => (
                <label key={perm.permission_id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.permission_ids.includes(perm.permission_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          permission_ids: [...formData.permission_ids, perm.permission_id],
                        })
                      } else {
                        setFormData({
                          ...formData,
                          permission_ids: formData.permission_ids.filter((id) => id !== perm.permission_id),
                        })
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {perm.name}
                    <span className="text-tertiary text-xs ml-2">({perm.code})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border/70 pt-4">
            <button
              onClick={() => {
                setIsRoleModalOpen(false)
                setSelectedRole(null)
                setFormData({ name: '', description: '', permission_ids: [] })
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRole}
              disabled={rolesMutation.isPending}
              className="btn-primary"
            >
              {rolesMutation.isPending ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Permission Modal */}
      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title="Create Permission"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Permission Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., View Patients"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Code</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              placeholder="e.g., patients.read"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-border/70 pt-4">
            <button
              onClick={() => {
                setIsPermissionModalOpen(false)
                setFormData({ name: '', description: '', permission_ids: [] })
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!formData.name || !formData.description) {
                  toast.error('All fields are required')
                  return
                }
                permissionMutation.mutate({
                  name: formData.name,
                  code: formData.description,
                  category: 'Custom',
                })
              }}
              disabled={permissionMutation.isPending}
              className="btn-primary"
            >
              {permissionMutation.isPending ? 'Creating...' : 'Create Permission'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RolesPermissions