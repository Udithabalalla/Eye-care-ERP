import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit02, SearchLg, Lock01, Lock02 } from '@untitledui/icons'
import { Table, TableCard, Input } from '@/components/ui'
import Button from '@/components/common/Button'
import Loading from '@/components/common/Loading'
import Modal from '@/components/common/Modal'
import toast from 'react-hot-toast'
import { usersApi } from '@/api/users.api'
import type { User } from '@/api/users.api'

const Users = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'staff',
    department: '',
    phone: '',
  })
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // Users Query
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.listUsers(),
  })

  // Create/Update Mutation
  const saveUserMutation = useMutation({
    mutationFn: (data: any) =>
      selectedUser ? usersApi.updateUser(selectedUser.user_id, data) : usersApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsModalOpen(false)
      setSelectedUser(null)
      setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
      toast.success(selectedUser ? 'User updated' : 'User created')
    },
    onError: () => toast.error('Failed to save user'),
  })

  // Deactivate Mutation
  const deactivateUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
    },
    onError: () => toast.error('Failed to deactivate user'),
  })

  // Activate Mutation
  const activateUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.activateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User activated')
    },
    onError: () => toast.error('Failed to activate user'),
  })

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => usersApi.resetPassword(userId, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setResetPasswordOpen(false)
      setNewPassword('')
      setSelectedUser(null)
      toast.success('Password reset successfully')
    },
    onError: () => toast.error('Failed to reset password'),
  })

  const handleSaveUser = () => {
    if (!formData.email || !formData.name) {
      toast.error('Email and name are required')
      return
    }
    if (!selectedUser && !formData.password) {
      toast.error('Password is required for new users')
      return
    }
    const data = { ...formData }
    if (!selectedUser) {
      saveUserMutation.mutate(data)
    } else {
      const { password, ...updateData } = data
      saveUserMutation.mutate(updateData)
    }
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      department: user.department || '',
      phone: user.phone || '',
    })
    setIsModalOpen(true)
  }

  const usersDisplay = (usersData?.data || []).filter((user: User) => {
    const query = search.toLowerCase()
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Users"
          badge={usersDisplay.length}
          description="Manage system users and their roles"
          contentTrailing={(
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input
                placeholder="Search users..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                className="w-full sm:w-72"
              />
              <Button
                onClick={() => {
                  setSelectedUser(null)
                  setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
                  setIsModalOpen(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          )}
        />
        {isLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Head label="User" isRowHeader />
              <Table.Head label="Email" />
              <Table.Head label="Role" />
              <Table.Head label="Department" />
              <Table.Head label="Status" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body>
              {usersDisplay.map((user: User) => (
                <Table.Row key={user.user_id}>
                  <Table.Cell>
                    <span className="font-medium text-primary">{user.name}</span>
                  </Table.Cell>
                  <Table.Cell>{user.email}</Table.Cell>
                  <Table.Cell>
                    <span className="inline-block bg-brand-100 text-brand-700 px-2 py-1 rounded text-sm font-medium">
                      {user.role}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{user.department || '-'}</Table.Cell>
                  <Table.Cell>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                      user.is_active
                        ? 'bg-success-100 text-success-700'
                        : 'bg-error-100 text-error-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        title="Edit"
                      >
                        <Edit02 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setResetPasswordOpen(true)
                        }}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        title="Reset Password"
                      >
                        <Lock01 className="w-4 h-4" />
                      </button>
                      {user.is_active ? (
                        <button
                          onClick={() => {
                            if (window.confirm('Deactivate this user?')) {
                              deactivateUserMutation.mutate(user.user_id)
                            }
                          }}
                          className="p-2 hover:bg-error-100 rounded transition-colors text-error-600"
                          title="Deactivate"
                        >
                          <Lock02 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateUserMutation.mutate(user.user_id)}
                          className="p-2 hover:bg-success-100 rounded transition-colors text-success-600"
                          title="Activate"
                        >
                          <Lock02 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>

      {/* User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUser(null)
          setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
        }}
        title={selectedUser ? 'Edit User' : 'Create User'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!selectedUser}
              className="input w-full"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="John Doe"
            />
          </div>
          {!selectedUser && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input w-full"
                placeholder="••••••••"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="input w-full"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="input w-full"
              placeholder="e.g., Clinical, Operations"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input w-full"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setSelectedUser(null)
                setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleSaveUser} disabled={saveUserMutation.isPending} className="btn-primary">
              {saveUserMutation.isPending ? 'Saving...' : 'Save User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPasswordOpen}
        onClose={() => {
          setResetPasswordOpen(false)
          setNewPassword('')
          setSelectedUser(null)
        }}
        title="Reset Password"
      >
        <div className="space-y-4">
          <p className="text-secondary">Set a new password for {selectedUser?.name}</p>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              minLength={8}
            />
            <p className="text-xs text-tertiary mt-1">Minimum 8 characters</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setResetPasswordOpen(false)
                setNewPassword('')
                setSelectedUser(null)
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!newPassword || newPassword.length < 8) {
                  toast.error('Password must be at least 8 characters')
                  return
                }
                if (selectedUser) {
                  resetPasswordMutation.mutate(selectedUser.user_id)
                }
              }}
              disabled={resetPasswordMutation.isPending}
              className="btn-primary"
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Users