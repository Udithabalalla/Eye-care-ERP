import { Gender, Address } from './common.types'

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface MedicalHistory {
  allergies: string[]
  chronic_conditions: string[]
  current_medications: string[]
  family_history?: string
}

export interface Insurance {
  provider?: string
  policy_number?: string
  coverage_type?: string
}

export interface Patient {
  patient_id: string
  name: string
  date_of_birth: string
  age: number
  gender: Gender
  phone: string
  email?: string
  address?: Address
  emergency_contact?: EmergencyContact
  medical_history?: MedicalHistory
  insurance?: Insurance
  last_visit?: string
  next_appointment?: string
  total_visits: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PatientFormData {
  name: string
  date_of_birth: string
  gender: Gender
  phone: string
  email?: string
  address?: Address
  emergency_contact?: EmergencyContact
  medical_history?: MedicalHistory
  insurance?: Insurance
  notes?: string
}
