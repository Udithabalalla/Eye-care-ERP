import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiTeamLine } from '@remixicon/react'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
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
    if (selectedUser) {
      const { password, ...updateData } = data
      saveUserMutation.mutate(updateData)
    } else {
      saveUserMutation.mutate(data)
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

  const closeUserModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
    setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
  }

  const closeResetModal = () => {
    setResetPasswordOpen(false)
    setNewPassword('')
    setSelectedUser(null)
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
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage system users and their roles.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => {
            setSelectedUser(null)
            setFormData({ email: '', password: '', name: '', role: 'staff', department: '', phone: '' })
            setIsModalOpen(true)
          }}
        >
          <RiAddLine className="size-4" />
          Add User
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">User Records</CardTitle>
              <CardDescription>Manage system users and their roles.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {usersDisplay.length} total
            </Badge>
          </div>
          <div className="relative w-full sm:w-72">
            <RiTeamLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <div className="overflow-x-auto px-6">
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
                        <Badge variant="secondary" className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'outline'}>
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setSelectedUser(user); setResetPasswordOpen(true) }}
                            >
                              Reset Password
                            </DropdownMenuItem>
                            {user.is_active ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (window.confirm('Deactivate this user?'))
                                    deactivateUserMutation.mutate(user.user_id)
                                }}
                              >
                                Deactivate User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => activateUserMutation.mutate(user.user_id)}
                              >
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
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeUserModal() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedUser ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!selectedUser}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            {!selectedUser && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password *</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Department</label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Clinical, Operations"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={closeUserModal}>Cancel</Button>
              <Button onClick={handleSaveUser} disabled={saveUserMutation.isPending}>
                {saveUserMutation.isPending ? 'Saving...' : 'Save User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={(open) => { if (!open) closeResetModal() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for <span className="font-medium text-foreground">{selectedUser?.name}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={closeResetModal}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!newPassword || newPassword.length < 8) {
                    toast.error('Password must be at least 8 characters')
                    return
                  }
                  if (selectedUser) resetPasswordMutation.mutate(selectedUser.user_id)
                }}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Users
