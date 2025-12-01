export interface EyeMeasurement {
  sphere: number
  cylinder: number
  axis: number
  add: number
  pupillary_distance: number
}

export interface EyePrescription {
  right_eye: EyeMeasurement
  left_eye: EyeMeasurement
  prescription_type: 'single-vision' | 'bifocal' | 'progressive'
}

export interface Medication {
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  quantity: number
}

export interface ContactLensSpec {
  brand: string
  power: number
  base_curve: number
  diameter: number
}

export interface ContactLenses {
  right_eye: ContactLensSpec
  left_eye: ContactLensSpec
  replacement_schedule: string
}

export interface Prescription {
  prescription_id: string
  patient_id: string
  patient_name: string
  doctor_id: string
  doctor_name: string
  appointment_id?: string
  prescription_date: string
  valid_until: string
  eye_prescription?: EyePrescription
  medications: Medication[]
  contact_lenses?: ContactLenses
  diagnosis: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface PrescriptionFormData {
  patient_id: string
  doctor_id: string
  prescription_date: string
  valid_until: string
  eye_prescription?: EyePrescription
  medications?: Medication[]
  contact_lenses?: ContactLenses
  diagnosis: string
  notes?: string
  appointment_id?: string
}
