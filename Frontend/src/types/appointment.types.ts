import { AppointmentStatus, AppointmentType } from './common.types'

export interface Appointment {
  appointment_id: string
  patient_id: string
  patient_name: string
  doctor_id: string
  doctor_name: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  type: AppointmentType
  status: AppointmentStatus
  reason: string
  notes?: string
  reminder_sent: boolean
  created_by: string
  created_at: string
  updated_at: string
  cancelled_at?: string
  cancellation_reason?: string
}

export interface AppointmentFormData {
  patient_id: string
  doctor_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  type: AppointmentType
  reason: string
  notes?: string
}
