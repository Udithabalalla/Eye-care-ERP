export const APP_NAME = 'Vision Optical'
export const APP_VERSION = '1.0.0'

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  PATIENTS: '/patients',
  APPOINTMENTS: '/appointments',
  PRESCRIPTIONS: '/prescriptions',
  PRODUCTS: '/products',
  INVOICES: '/invoices',
  REPORTS: '/reports',
}

export const DATE_FORMAT = 'MMM dd, yyyy'
export const TIME_FORMAT = 'hh:mm a'
export const DATETIME_FORMAT = 'MMM dd, yyyy hh:mm a'

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
}

export const STATUS_COLORS = {
  scheduled: 'blue',
  confirmed: 'green',
  'in-progress': 'yellow',
  completed: 'gray',
  cancelled: 'red',
  'no-show': 'orange',
  paid: 'green',
  partial: 'yellow',
  pending: 'orange',
  overdue: 'red',
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  doctor: 'Doctor',
  optometrist: 'Optometrist',
  staff: 'Staff',
  receptionist: 'Receptionist',
}

export const PRODUCT_CATEGORIES = [
  { value: 'contact-lenses', label: 'Contact Lenses' },
  { value: 'eyeglasses', label: 'Eyeglasses' },
  { value: 'frames', label: 'Frames' },
  { value: 'sunglasses', label: 'Sunglasses' },
  { value: 'eye-drops', label: 'Eye Drops' },
  { value: 'accessories', label: 'Accessories' },
]
