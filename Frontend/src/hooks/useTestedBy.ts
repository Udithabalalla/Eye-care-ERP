import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { testersApi } from '@/api/testers.api'
import { usersApi } from '@/api/users.api'

export const TESTERS_QUERY_KEY = ['testers'] as const

export interface TestedByOption {
  value: string
  label: string
  subtitle?: string
}

/**
 * The "Tested by" picker and the names behind past orders.
 *
 * The options are the names the admin keeps in Settings → Tested By. Until any are added,
 * the staff accounts are offered instead, as before. Orders store an id: a listed name's id,
 * or (older orders) a staff account's user_id, so `nameOf` looks in both, and still finds
 * names that were removed from the list later.
 */
export const useTestedBy = (enabled = true) => {
  const { data: testers, isSuccess: testersLoaded } = useQuery({
    queryKey: TESTERS_QUERY_KEY,
    queryFn: () => testersApi.getAll(),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
  // Shared cache with the rest of the app
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ page: 1, page_size: 500 }),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return useMemo(() => {
    const users: Array<{ user_id: string; name: string; is_active?: boolean }> =
      Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? [])
    const listed = (testers ?? []).filter((t) => t.is_active)
    const usingStaffAccounts = testersLoaded && listed.length === 0

    const options: TestedByOption[] = usingStaffAccounts
      ? users.filter((u) => u?.is_active).map((u) => ({ value: u.user_id, label: u.name }))
      : listed.map((t) => ({ value: t.id, label: t.name, subtitle: t.title || undefined }))

    const names = new Map<string, string>()
    users.forEach((u) => u?.user_id && names.set(u.user_id, u.name))
    ;(testers ?? []).forEach((t) => names.set(t.id, t.name))
    const nameOf = (id?: string | null) => (id ? names.get(id) : undefined)

    return { options, nameOf, usingStaffAccounts }
  }, [testers, testersLoaded, usersData])
}
