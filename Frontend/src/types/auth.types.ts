import { UserRole } from './common.types'

export interface User {
  user_id: string
  email: string
  name: string
  role: UserRole
  department?: string
  phone?: string
  is_active: boolean
  avatar_url?: string
  last_login?: string
  created_at: string
  /** The password was set by an admin and has to be replaced before anything else */
  must_change_password?: boolean
  /** Permission codes like `patients.read`; `['*']` for admins (from /auth/me) */
  permissions?: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirmRequest {
  email: string
  otp: string
  new_password: string
}

export interface PasswordResetResponse {
  message: string
}

export interface SignupRequest {
  email: string
  password: string
  name: string
  role: UserRole
  department?: string
  phone?: string
}

/** A code was emailed; the account exists once it is entered */
export interface SignupStarted {
  message: string
  email: string
  expires_in_minutes: number
}

export interface LoginResponse {
  access_token: string
  token_type: string
  refresh_token?: string
  user: User
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  /** Emails a confirmation code; nothing is created yet */
  signup: (data: SignupRequest) => Promise<SignupStarted>
  /** Creates the account from the emailed code and signs in */
  verifySignup: (email: string, otp: string) => Promise<void>
  requestPasswordReset: (data: PasswordResetRequest) => Promise<PasswordResetResponse>
  confirmPasswordReset: (data: PasswordResetConfirmRequest) => Promise<PasswordResetResponse>
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
}
