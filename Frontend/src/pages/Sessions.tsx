import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiComputerLine, RiLogoutBoxRLine, RiMore2Line, RiRefreshLine, RiSearchLine } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { describeDevice, formatDateTime, parseServerDate, roleLabel, timeAgo } from '@/lib/access'
import { sessionsApi, type Session } from '@/api/sessions.api'
import { usersApi } from '@/api/users.api'

// Someone counts as "active now" if the app heard from them this recently
const ACTIVE_WINDOW_MS = 5 * 60 * 1000

type Confirm = { kind: 'one'; session: Session } | { kind: 'user'; session: Session; count: number } | null

const isActiveNow = (session: Session) => {
  const seen = parseServerDate(session.last_seen_at)
  return !!seen && Date.now() - seen.getTime() < ACTIVE_WINDOW_MS
}

const Sessions = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const userFilter = searchParams.get('user')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<Confirm>(null)

  const { data: sessions = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
    refetchInterval: 30_000,
  })

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['users'] })
    toast.success(message)
    setConfirm(null)
  }

  const revokeMutation = useMutation({
    mutationFn: (session: Session) => sessionsApi.revoke(session.session_id),
    onSuccess: (_, session) => done(`Signed out ${session.user_name ?? 'the user'} on ${describeDevice(session.user_agent)}`),
  })

  const revokeUserMutation = useMutation({
    mutationFn: (session: Session) => usersApi.signOutEverywhere(session.user_id),
    onSuccess: (result, session) =>
      done(`Signed ${session.user_name ?? 'the user'} out of ${result.revoked} ${result.revoked === 1 ? 'session' : 'sessions'}`),
  })

  const perUser = useMemo(() => {
    const counts = new Map<string, number>()
    sessions.forEach((s) => counts.set(s.user_id, (counts.get(s.user_id) ?? 0) + 1))
    return counts
  }, [sessions])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sessions.filter(
      (s) =>
        (!userFilter || s.user_id === userFilter) &&
        (!query ||
          (s.user_name ?? '').toLowerCase().includes(query) ||
          (s.user_email ?? '').toLowerCase().includes(query) ||
          (s.ip_address ?? '').includes(query) ||
          describeDevice(s.user_agent).toLowerCase().includes(query)),
    )
  }, [sessions, search, userFilter])

  const activeNow = sessions.filter(isActiveNow)
  const filteredName = userFilter ? sessions.find((s) => s.user_id === userFilter)?.user_name ?? userFilter : null

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signed-in Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Every device that is signed in. Signing one out ends it straight away; the person has to sign in again.
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={() => refetch()} disabled={isFetching}>
          <RiRefreshLine className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          Refresh
        </Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'People signed in', value: perUser.size },
          { label: 'Devices', value: sessions.length },
          { label: 'Active in the last 5 minutes', value: new Set(activeNow.map((s) => s.user_id)).size },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Sessions</CardTitle>
              <CardDescription>
                A session lasts 7 days from sign-in unless it is signed out. Last activity updates about once a minute.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{visible.length} shown</Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, device or IP"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {filteredName && (
              <Badge variant="outline" className="h-8 gap-2 px-3">
                Only {filteredName}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchParams({})}
                  aria-label="Show everyone"
                >
                  ×
                </button>
              </Badge>
            )}
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
                    <TableHead>Device</TableHead>
                    <TableHead>Signed in</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          {session.user_name ?? session.user_id}
                          <Badge variant="secondary" className="h-5 text-[10px]">{roleLabel(session.user_role)}</Badge>
                          {!session.user_is_active && <Badge variant="outline" className="h-5 text-[10px]">Deactivated</Badge>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{session.user_email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm text-foreground" title={session.user_agent ?? undefined}>
                          <RiComputerLine className="size-4 shrink-0 text-muted-foreground" />
                          {describeDevice(session.user_agent)}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {session.ip_address ?? 'IP not recorded'}
                          {session.is_current && <Badge className="h-4 px-1.5 text-[10px]">This browser</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="block text-foreground">{formatDateTime(session.signed_in_at)}</span>
                        <span className="block text-xs text-muted-foreground">{timeAgo(session.signed_in_at)}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isActiveNow(session) ? (
                          <Badge variant="outline" className="gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                            Active now
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{timeAgo(session.last_seen_at, 'Not recorded')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title="Sign out this session"
                            aria-label={`Sign out ${session.user_name ?? 'this session'} on ${describeDevice(session.user_agent)}`}
                            onClick={() => setConfirm({ kind: 'one', session })}
                          >
                            <RiLogoutBoxRLine className="size-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`More for ${session.user_name ?? 'this session'}`}>
                                <RiMore2Line className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuItem onSelect={() => setSearchParams({ user: session.user_id })}>
                                Show only {session.user_name ?? 'this user'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() =>
                                  setConfirm({ kind: 'user', session, count: perUser.get(session.user_id) ?? 1 })
                                }
                              >
                                Sign out all of their sessions ({perUser.get(session.user_id) ?? 1})
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {visible.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {sessions.length === 0 ? 'Nobody is signed in.' : 'No sessions match.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'user'
                ? `Sign ${confirm.session.user_name} out of ${confirm.count === 1 ? 'their session' : `all ${confirm.count} sessions`}?`
                : `Sign out ${confirm?.session.user_name} on ${describeDevice(confirm?.session.user_agent)}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(confirm?.kind === 'one' && confirm.session.is_current) ||
              (confirm?.kind === 'user' && sessions.some((s) => s.is_current && s.user_id === confirm.session.user_id))
                ? 'This includes the browser you are using now, so you will be taken to the sign-in page.'
                : 'They can keep working only after signing in again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeMutation.isPending || revokeUserMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!confirm) return
                if (confirm.kind === 'one') revokeMutation.mutate(confirm.session)
                else revokeUserMutation.mutate(confirm.session)
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Sessions
