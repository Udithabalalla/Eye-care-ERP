import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiSearchLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesAndPermissionsApi.listRoles(),
  })

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesAndPermissionsApi.listPermissions(),
  })

  const rolesMutation = useMutation({
    mutationFn: (data: any) =>
      selectedRole ? rolesAndPermissionsApi.updateRole(selectedRole.role_id, data) : rolesAndPermissionsApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setIsRoleModalOpen(false)
      setSelectedRole(null)
      setFormData({ name: '', description: '', permission_ids: [] })
      toast.success(selectedRole ? 'Role updated' : 'Role created')
    },
    onError: () => toast.error('Failed to save role'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => rolesAndPermissionsApi.deleteRole(roleId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted') },
    onError: () => toast.error('Failed to delete role'),
  })

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
    if (!formData.name) { toast.error('Role name is required'); return }
    rolesMutation.mutate({ name: formData.name, description: formData.description, permission_ids: formData.permission_ids })
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setFormData({ name: role.name, description: role.description || '', permission_ids: role.permission_ids })
    setIsRoleModalOpen(true)
  }

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) deleteRoleMutation.mutate(roleId)
  }

  const rolesDisplay = (rolesData?.data || []).filter((role: Role) => {
    const query = search.toLowerCase()
    return role.name.toLowerCase().includes(query) || (role.description?.toLowerCase().includes(query) ?? false)
  })

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === 'roles' ? 'text-foreground border-b-2 border-brand-600' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === 'permissions' ? 'text-foreground border-b-2 border-brand-600' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Permissions
        </button>
      </div>

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Roles</CardTitle>
                  <Badge variant="secondary">{rolesDisplay.length}</Badge>
                </div>
                <CardDescription>Manage system roles and permissions</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                  <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search roles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={() => {
                    setSelectedRole(null)
                    setFormData({ name: '', description: '', permission_ids: [] })
                    setIsRoleModalOpen(true)
                  }}
                >
                  <RiAddLine className="size-4 mr-1" />
                  Add Role
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rolesLoading ? (
                <div className="p-8"><Loading /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolesDisplay.map((role: Role) => (
                      <TableRow key={role.role_id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{role.name}</span>
                        </TableCell>
                        <TableCell>{role.description || '-'}</TableCell>
                        <TableCell>
                          <span className="inline-block bg-brand-100 text-brand-700 px-2 py-1 rounded text-sm">
                            {role.permission_ids.length} permissions
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={role.is_active
                              ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                              : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'}
                          >
                            {role.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditRole(role)}
                              className="p-2 hover:bg-secondary rounded transition-colors"
                              title="Edit"
                            >
                              <RiEditLine className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRole(role.role_id)}
                              className="p-2 hover:bg-error-100 rounded transition-colors text-error-600"
                              title="Delete"
                            >
                              <RiDeleteBinLine className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Permissions</CardTitle>
                  <Badge variant="secondary">{(permissionsData?.data || []).length}</Badge>
                </div>
                <CardDescription>System permissions and access controls</CardDescription>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setIsPermissionModalOpen(true)}>
                  <RiAddLine className="size-4 mr-1" />
                  Add Permission
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {permissionsLoading ? (
                <div className="p-8"><Loading /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(permissionsData?.data || []).map((perm: Permission) => (
                      <TableRow key={perm.permission_id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{perm.name}</span>
                        </TableCell>
                        <TableCell>
                          <code className="bg-secondary px-2 py-1 rounded text-sm">{perm.code}</code>
                        </TableCell>
                        <TableCell>{perm.category}</TableCell>
                        <TableCell>{perm.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => { setIsRoleModalOpen(false); setSelectedRole(null); setFormData({ name: '', description: '', permission_ids: [] }) }}
        title={selectedRole ? 'Edit Role' : 'Create Role'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Role Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Role description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Permissions</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(permissionsData?.data || []).map((perm: Permission) => (
                <label key={perm.permission_id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.permission_ids.includes(perm.permission_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, permission_ids: [...formData.permission_ids, perm.permission_id] })
                      } else {
                        setFormData({ ...formData, permission_ids: formData.permission_ids.filter((id) => id !== perm.permission_id) })
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {perm.name}
                    <span className="text-muted-foreground text-xs ml-2">({perm.code})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setIsRoleModalOpen(false); setSelectedRole(null); setFormData({ name: '', description: '', permission_ids: [] }) }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={rolesMutation.isPending}>
              {rolesMutation.isPending ? 'Saving...' : 'Save Role'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title="Create Permission"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Permission Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., View Patients"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Code</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., patients.read"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setIsPermissionModalOpen(false); setFormData({ name: '', description: '', permission_ids: [] }) }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!formData.name || !formData.description) { toast.error('All fields are required'); return }
                permissionMutation.mutate({ name: formData.name, code: formData.description, category: 'Custom' })
              }}
              disabled={permissionMutation.isPending}
            >
              {permissionMutation.isPending ? 'Creating...' : 'Create Permission'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RolesPermissions
