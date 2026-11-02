import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiArrowGoBackLine, RiLoader4Line } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Loading from '@/components/common/Loading'
import PermissionGrid from './PermissionGrid'
import { roleLabel } from '@/lib/access'
import { rolesAndPermissionsApi } from '@/api/roles.api'
import { usersApi, type AdminUser } from '@/api/users.api'

interface UserPermissionsDialogProps {
  user: AdminUser | null
  onClose: () => void
}

// One person's permissions: their role's, plus anything added or taken away for them only
export function UserPermissionsDialog({ user, onClose }: UserPermissionsDialogProps) {
  const queryClient = useQueryClient()
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['permission-modules'],
    queryFn: rolesAndPermissionsApi.listPermissionModules,
    staleTime: Infinity,
    enabled: !!user,
  })
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.user_id],
    queryFn: () => usersApi.getPermissions(user!.user_id),
    enabled: !!user,
  })

  useEffect(() => {
    if (permissions) setChecked(new Set(permissions.effective))
  }, [permissions])

  const fromRole = useMemo(() => new Set(permissions?.role_permissions ?? []), [permissions])
  const granted = [...checked].filter((code) => !fromRole.has(code))
  const revoked = [...fromRole].filter((code) => !checked.has(code))
  const isAdmin = user?.role === 'admin'
  const dirty =
    !!permissions &&
    (granted.length !== permissions.granted.length ||
      revoked.length !== permissions.revoked.length ||
      granted.some((c) => !permissions.granted.includes(c)) ||
      revoked.some((c) => !permissions.revoked.includes(c)))

  const mutation = useMutation({
    mutationFn: () => usersApi.setPermissions(user!.user_id, { granted, revoked }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['user-permissions', user?.user_id], saved)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Permissions saved for ${user?.name}`)
      onClose()
    },
  })

  const toggle = (code: string, next: boolean) =>
    setChecked((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(code)
      else copy.delete(code)
      return copy
    })

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Permissions for {user?.name}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Admins can do everything; there is nothing to change here.'
              : `Starts from the ${roleLabel(user?.role)} role. Ticks you add or remove apply to ${user?.name} only, from their next action.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading || modulesLoading ? (
          <div className="py-10"><Loading /></div>
        ) : (
          <div className="overflow-x-auto">
            <PermissionGrid
              modules={modules}
              checked={checked}
              onToggle={toggle}
              disabled={isAdmin}
              changeOf={(code) =>
                checked.has(code) && !fromRole.has(code) ? 'added'
                : !checked.has(code) && fromRole.has(code) ? 'removed'
                : undefined
              }
            />
          </div>
        )}

        {!isAdmin && (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={granted.length === 0 && revoked.length === 0}
              onClick={() => setChecked(new Set(fromRole))}
            >
              <RiArrowGoBackLine className="size-4" />
              Same as role
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default UserPermissionsDialog
