import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiKeyLine,
  RiLogoutBoxRLine,
  RiMore2Line,
  RiPencilLine,
  RiSearchLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserForbidLine,
  RiUserFollowLine,
} from '@remixicon/react'
import toast from 'react-hot-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Loading from '@/components/common/Loading'
import UserFormDialog from '@/components/admin/UserFormDialog'
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog'
import UserPermissionsDialog from '@/components/admin/UserPermissionsDialog'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_OPTIONS, roleLabel, timeAgo } from '@/lib/access'
import { usersApi, type AdminUser } from '@/api/users.api'

type Confirm = { kind: 'deactivate' | 'sign-out'; user: AdminUser } | null

const Users = () => {
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [resetting, setResetting] = useState<AdminUser | null>(null)
  const [permissionsFor, setPermissionsFor] = useState<AdminUser | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await usersApi.listUsers(1, 500)).data as AdminUser[],
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['roles'] })
  }

  const deactivateMutation = useMutation({
    mutationFn: (user: AdminUser) => usersApi.deactivateUser(user.user_id),
    onSuccess: (_, user) => {
      refresh()
      toast.success(`${user.name} can no longer sign in`)
      setConfirm(null)
    },
  })

  const activateMutation = useMutation({
    mutationFn: (user: AdminUser) => usersApi.activateUser(user.user_id),
    onSuccess: (_, user) => {
      refresh()
      toast.success(`${user.name} can sign in again`)
    },
  })

  const signOutMutation = useMutation({
    mutationFn: (user: AdminUser) => usersApi.signOutEverywhere(user.user_id),
    onSuccess: (result, user) => {
      refresh()
      toast.success(`Signed ${user.name} out of ${result.revoked} ${result.revoked === 1 ? 'session' : 'sessions'}`)
      setConfirm(null)
    },
  })

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter(
      (user) =>
        (roleFilter === 'all' || user.role === roleFilter) &&
        (!query ||
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.department ?? '').toLowerCase().includes(query)),
    )
  }, [users, search, roleFilter])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            Create accounts, set roles and passwords, and decide who can sign in.
          </p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={openCreate}>
          <RiUserAddLine className="size-4" />
          Add user
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Accounts</CardTitle>
              <CardDescription>Deactivated accounts can't sign in and are signed out straight away.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{visible.length} of {users.length}</Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email or department"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Signed in on</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((user) => {
                    const isMe = user.user_id === me?.user_id
                    const customised = user.granted_permissions.length + user.revoked_permissions.length > 0
                    return (
                      <TableRow key={user.user_id} className={user.is_active ? undefined : 'opacity-60'}>
                        <TableCell>
                          <span className="block font-medium text-foreground">
                            {user.name}
                            {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{user.email}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">{roleLabel(user.role)}</Badge>
                            {customised && (
                              <Badge variant="outline" title="Has permissions added or removed just for them">
                                Custom
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={user.is_active ? 'default' : 'outline'}>
                              {user.is_active ? 'Active' : 'Deactivated'}
                            </Badge>
                            {user.must_change_password && user.is_active && (
                              <Badge variant="outline">Must set password</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{timeAgo(user.last_login)}</TableCell>
                        <TableCell>
                          {user.active_sessions > 0 ? (
                            <Link
                              to={`/sessions?user=${encodeURIComponent(user.user_id)}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {user.active_sessions} {user.active_sessions === 1 ? 'device' : 'devices'}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="data-[state=open]:bg-muted"
                                aria-label={`Actions for ${user.name}`}
                              >
                                <RiMore2Line className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onSelect={() => { setEditing(user); setFormOpen(true) }}>
                                <RiPencilLine className="size-4" />
                                Edit details and role
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setPermissionsFor(user)}>
                                <RiShieldCheckLine className="size-4" />
                                Permissions
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setResetting(user)}>
                                <RiKeyLine className="size-4" />
                                Set a new password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={user.active_sessions === 0}
                                onSelect={() => setConfirm({ kind: 'sign-out', user })}
                              >
                                <RiLogoutBoxRLine className="size-4" />
                                Sign out everywhere
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.is_active ? (
                                <DropdownMenuItem
                                  disabled={isMe}
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setConfirm({ kind: 'deactivate', user })}
                                >
                                  <RiUserForbidLine className="size-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onSelect={() => activateMutation.mutate(user)}>
                                  <RiUserFollowLine className="size-4" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {visible.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No users match.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        user={editing}
        currentUserId={me?.user_id}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <UserPermissionsDialog user={permissionsFor} onClose={() => setPermissionsFor(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'deactivate' ? `Deactivate ${confirm.user.name}?` : `Sign ${confirm?.user.name} out everywhere?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'deactivate'
                ? 'They are signed out on every device and can’t sign in until you reactivate the account. Their records stay as they are.'
                : `${confirm?.user.active_sessions === 1 ? 'Their session ends' : `All ${confirm?.user.active_sessions} of their sessions end`} now. They can sign in again with their password.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deactivateMutation.isPending || signOutMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!confirm) return
                if (confirm.kind === 'deactivate') deactivateMutation.mutate(confirm.user)
                else signOutMutation.mutate(confirm.user)
              }}
            >
              {confirm?.kind === 'deactivate' ? 'Deactivate' : 'Sign out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Users
