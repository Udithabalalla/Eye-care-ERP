export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T = any> {
  success: boolean
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Address {
  street?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  OPTOMETRIST = 'optometrist',
  STAFF = 'staff',
  RECEPTIONIST = 'receptionist',
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show',
}

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow-up',
  EMERGENCY = 'emergency',
  SCREENING = 'screening',
}

export enum PaymentStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  PENDING = 'pending',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  NETBANKING = 'netbanking',
  INSURANCE = 'insurance',
}

export enum ProductCategory {
  CONTACT_LENSES = 'contact-lenses',
  EYEGLASSES = 'eyeglasses',
  FRAMES = 'frames',
  SUNGLASSES = 'sunglasses',
  EYE_DROPS = 'eye-drops',
  ACCESSORIES = 'accessories',
}
