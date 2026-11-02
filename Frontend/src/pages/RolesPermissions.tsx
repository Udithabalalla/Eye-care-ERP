import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiArrowGoBackLine, RiLoader4Line, RiShieldCheckLine } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import PermissionGrid from '@/components/admin/PermissionGrid'
import { cn } from '@/lib/utils'
import { rolesAndPermissionsApi, type Role } from '@/api/roles.api'

const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((code) => a.has(code))

const RolesPermissions = () => {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string>('doctor')
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [confirmReset, setConfirmReset] = useState(false)

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesAndPermissionsApi.listRoles,
  })
  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['permission-modules'],
    queryFn: rolesAndPermissionsApi.listPermissionModules,
    staleTime: Infinity,
  })

  const selected = roles.find((r) => r.role_id === selectedId)
  const allCodes = useMemo(
    () => modules.flatMap((m) => m.actions.map((action) => `${m.module}.${action}`)),
    [modules],
  )

  // Start the draft from what's stored whenever another role is picked or saved
  useEffect(() => {
    if (!selected) return
    setDraft(new Set(selected.editable ? selected.permission_ids : allCodes))
  }, [selected, allCodes])

  const dirty = !!selected?.editable && !sameSet(draft, selected.permission_ids)

  const onSaved = (role: Role, message: string) => {
    queryClient.setQueryData<Role[]>(['roles'], (old) => old?.map((r) => (r.role_id === role.role_id ? role : r)))
    toast.success(message)
  }

  const saveMutation = useMutation({
    mutationFn: () => rolesAndPermissionsApi.updateRole(selectedId, { permission_ids: [...draft] }),
    onSuccess: (role) => onSaved(role, `${role.name} permissions saved`),
  })

  const resetMutation = useMutation({
    mutationFn: () => rolesAndPermissionsApi.resetRole(selectedId),
    onSuccess: (role) => {
      setConfirmReset(false)
      onSaved(role, `${role.name} is back to its default permissions`)
    },
  })

  const toggle = (code: string, next: boolean) =>
    setDraft((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(code)
      else copy.delete(code)
      return copy
    })

  if (rolesLoading || modulesLoading) {
    return <div className="py-16"><Loading /></div>
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Decide what each role is allowed to see and do. Changes apply to everyone with that role on their next action.
          To change it for one person, use <Link to="/users" className="font-medium text-primary hover:underline">Users</Link>.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:items-start">
        <nav aria-label="Roles" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {roles.map((role) => (
            <button
              key={role.role_id}
              type="button"
              onClick={() => setSelectedId(role.role_id)}
              aria-current={role.role_id === selectedId ? 'true' : undefined}
              className={cn(
                'flex min-w-44 shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                role.role_id === selectedId
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-card hover:bg-accent/50',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{role.name}</span>
                {!role.editable ? (
                  <Badge variant="outline" className="h-5 text-[10px]">Full access</Badge>
                ) : !role.matches_defaults ? (
                  <Badge variant="secondary" className="h-5 text-[10px]">Customised</Badge>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {role.user_count} active {role.user_count === 1 ? 'user' : 'users'}
              </span>
            </button>
          ))}
        </nav>

        {selected && (
          <Card className="min-w-0 border-border/60">
            <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <RiShieldCheckLine className="size-5 text-primary" />
                  {selected.name}
                </CardTitle>
                <CardDescription>{selected.description}</CardDescription>
              </div>
              {selected.editable && (
                <div className="flex flex-wrap gap-2">
                  {!selected.matches_defaults && (
                    <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                      <RiArrowGoBackLine className="size-4" />
                      Reset to defaults
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!dirty}
                    onClick={() => setDraft(new Set(selected.permission_ids))}
                  >
                    Discard
                  </Button>
                  <Button size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                    {saveMutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {!selected.editable && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Admins can do everything, including managing users, roles and sessions. That can't be changed or given
                  to another role.
                </p>
              )}
              <div className="overflow-x-auto">
                <PermissionGrid modules={modules} checked={draft} onToggle={toggle} disabled={!selected.editable} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmReset} onOpenChange={(open) => !open && setConfirmReset(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {selected?.name} to its defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Every change made to this role's permissions is undone. Permissions given to or taken from individual
              users stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default RolesPermissions
