import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiSearchLine, RiMore2Line } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.listUsers(),
  })

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

  const deactivateUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deactivateUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError: () => toast.error('Failed to deactivate user'),
  })

  const activateUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.activateUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User activated') },
    onError: () => toast.error('Failed to activate user'),
  })

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
    if (!formData.email || !formData.name) { toast.error('Email and name are required'); return }
    if (!selectedUser && !formData.password) { toast.error('Password is required for new users'); return }
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
    setFormData({ email: user.email, password: '', name: user.name, role: user.role, department: user.department || '', phone: user.phone || '' })
    setIsModalOpen(true)
  }

  const usersDisplay = (usersData?.data || []).filter((user: User) => {
    const query = search.toLowerCase()
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.role.toLowerCase().includes(query)
  })

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Users</CardTitle>
              <Badge variant="secondary">{usersDisplay.length}</Badge>
            </div>
            <CardDescription>Manage system users and their roles</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedUser(null)
                setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
                setIsModalOpen(true)
              }}
            >
              <RiAddLine className="size-4 mr-1" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersDisplay.map((user: User) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className="inline-block bg-brand-100 text-brand-700 px-2 py-1 rounded text-sm font-medium">
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={user.is_active
                          ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                          : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[state=open]:bg-muted"
                            aria-label="Open user actions"
                          >
                            <RiMore2Line className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedUser(user); setResetPasswordOpen(true) }}>
                            Reset Password
                          </DropdownMenuItem>
                          {user.is_active ? (
                            <DropdownMenuItem onClick={() => { if (window.confirm('Deactivate this user?')) deactivateUserMutation.mutate(user.user_id) }}>
                              Deactivate User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => activateUserMutation.mutate(user.user_id)}>
                              Activate User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedUser(null); setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' }) }}
        title={selectedUser ? 'Edit User' : 'Create User'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!selectedUser}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          {!selectedUser && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Password</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Department</label>
            <Input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Clinical, Operations"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setIsModalOpen(false); setSelectedUser(null); setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' }) }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saveUserMutation.isPending}>
              {saveUserMutation.isPending ? 'Saving...' : 'Save User'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={resetPasswordOpen}
        onClose={() => { setResetPasswordOpen(false); setNewPassword(''); setSelectedUser(null) }}
        title="Reset Password"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">Set a new password for {selectedUser?.name}</p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setResetPasswordOpen(false); setNewPassword(''); setSelectedUser(null) }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
                if (selectedUser) resetPasswordMutation.mutate(selectedUser.user_id)
              }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Users
