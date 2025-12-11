export interface Doctor {
    doctor_id: string
    name: string
    specialization: string
    qualification?: string
    experience_years?: number
    contact_number?: string
    email?: string
    consultation_fee: number
    available_days: string[]
    available_time_start: string
    available_time_end: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface DoctorFormData {
    name: string
    specialization: string
    qualification?: string
    experience_years?: number
    contact_number?: string
    email?: string
    consultation_fee: number
    available_days: string[]
    available_time_start: string
    available_time_end: string
    is_active: boolean
}
