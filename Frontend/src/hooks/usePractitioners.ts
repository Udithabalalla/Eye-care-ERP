import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { doctorsApi } from '@/api/doctors.api'
import { usersApi, type User } from '@/api/users.api'
import type { Doctor } from '@/types/doctor.types'

/** Anyone who can see patients: a doctor profile, or a doctor/optometrist login without one */
export interface Practitioner {
  id: string
  name: string
  /** Specialization for profiles, role for staff logins */
  title: string
  email?: string
  /** Working days and hours, when a doctor profile exists */
  doctor?: Doctor
  /** A staff login that has no doctor profile yet */
  user?: User
}

const normalize = (value?: string) => (value || '').trim().toLowerCase().replace(/^dr\.?\s+/, '')

/** A doctor profile and a staff login belong to the same person (same email, or same name) */
export const isSamePerson = (doctor: Pick<Doctor, 'name' | 'email'>, user: Pick<User, 'name' | 'email'>) =>
  (!!doctor.email && !!user.email && doctor.email.toLowerCase() === user.email.toLowerCase()) ||
  normalize(doctor.name) === normalize(user.name)

/** Doctor and optometrist logins; needs the users.read permission, so failures are expected */
export function useClinicalUsers() {
  return useQuery({
    queryKey: ['clinical-users'],
    queryFn: async () => {
      const [doctors, optometrists] = await Promise.all([
        usersApi.getAll({ role: 'doctor', page_size: 200 }),
        usersApi.getAll({ role: 'optometrist', page_size: 200 }),
      ])
      return [...doctors, ...optometrists].filter((u) => u.is_active !== false)
    },
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/**
 * Doctors live in two places: profiles on the Doctors page (with schedules) and staff
 * logins with a clinical role. Bookings and prescriptions accept either, so list both
 * without showing the same person twice.
 */
export function usePractitioners() {
  const doctorsQuery = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => doctorsApi.getAll({ active_only: true }),
  })
  const clinicalUsersQuery = useClinicalUsers()

  const practitioners = useMemo<Practitioner[]>(() => {
    const doctors = doctorsQuery.data ?? []
    const fromProfiles: Practitioner[] = doctors.map((doctor) => ({
      id: doctor.doctor_id,
      name: doctor.name,
      title: doctor.specialization,
      email: doctor.email,
      doctor,
    }))
    const withoutProfile: Practitioner[] = (clinicalUsersQuery.data ?? [])
      .filter((user) => !doctors.some((doctor) => isSamePerson(doctor, user)))
      .map((user) => ({
        id: user.user_id,
        name: user.name,
        title: user.role === 'optometrist' ? 'Optometrist' : 'Doctor',
        email: user.email,
        user,
      }))
    return [...fromProfiles, ...withoutProfile].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)))
  }, [doctorsQuery.data, clinicalUsersQuery.data])

  return {
    practitioners,
    isLoading: doctorsQuery.isLoading || (clinicalUsersQuery.isLoading && !clinicalUsersQuery.isError),
  }
}
