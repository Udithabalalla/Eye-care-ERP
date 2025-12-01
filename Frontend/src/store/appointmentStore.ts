import { create } from 'zustand'
import { Appointment } from '@/types/appointment.types'

interface AppointmentState {
  appointments: Appointment[]
  selectedAppointment: Appointment | null
  isLoading: boolean
  setAppointments: (appointments: Appointment[]) => void
  setSelectedAppointment: (appointment: Appointment | null) => void
  setLoading: (loading: boolean) => void
  updateAppointment: (appointment: Appointment) => void
  removeAppointment: (appointmentId: string) => void
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  selectedAppointment: null,
  isLoading: false,

  setAppointments: (appointments) => set({ appointments }),
  setSelectedAppointment: (appointment) => set({ selectedAppointment: appointment }),
  setLoading: (loading) => set({ isLoading: loading }),

  updateAppointment: (updatedAppointment) =>
    set((state) => ({
      appointments: state.appointments.map((a) =>
        a.appointment_id === updatedAppointment.appointment_id ? updatedAppointment : a
      ),
    })),

  removeAppointment: (appointmentId) =>
    set((state) => ({
      appointments: state.appointments.filter((a) => a.appointment_id !== appointmentId),
    })),
}))
