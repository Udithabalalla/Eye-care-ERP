import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Lock01, Mail01, User01, Phone01 } from '@untitledui/icons'
import { UserRole } from '@/types/common.types'
import toast from 'react-hot-toast'

const Signup = () => {
  const navigate = useNavigate()
  const { signup, isLoading } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.STAFF)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !email || !password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      await signup({ name, email, password, role, phone: phone || undefined })
      navigate('/')
    } catch (error) {
      console.error('Signup failed:', error)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg-secondary lg:grid-cols-2">
      <section className="hidden bg-black px-10 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-apple bg-brand-600 text-lg font-semibold">
            EC
          </div>
          <h1 className="mt-8 max-w-md font-display text-[56px] font-semibold leading-[1.07] tracking-[-0.28px] text-white">
            Build clinical teams with precision.
          </h1>
          <p className="mt-4 max-w-lg text-[17px] tracking-[-0.374px] text-white/74">
            Create accounts for doctors, staff, and receptionists with an interface that stays consistent across light and dark modes.
          </p>
        </div>
        <p className="text-[12px] text-white/55">Eye Care ERP • Apple-inspired clinical interface</p>
      </section>

      <section className="flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-apple bg-brand-600">
              <span className="text-2xl font-bold text-white">EC</span>
            </div>
            <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Vision Optical</h1>
            <p className="mt-2 text-[17px] text-secondary">Institute Management System</p>
          </div>

          <div className="card bg-bg-primary ring-1 ring-border">
            <h2 className="mb-6 font-display text-[28px] font-normal leading-[1.14] tracking-[0.196px] text-primary">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-secondary">
                Full Name <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <User01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-secondary">
                Email Address <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <Mail01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-secondary">
                Phone Number
              </label>
              <div className="relative">
                <Phone01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="input pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Role Field */}
            <div>
              <label htmlFor="role" className="mb-2 block text-sm font-medium text-secondary">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="input"
                disabled={isLoading}
              >
                <option value={UserRole.STAFF}>Staff</option>
                <option value={UserRole.RECEPTIONIST}>Receptionist</option>
                <option value={UserRole.OPTOMETRIST}>Optometrist</option>
                <option value={UserRole.DOCTOR}>Doctor</option>
              </select>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-secondary">
                Password <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <Lock01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-fg-quaternary hover:text-fg-secondary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-tertiary">Must be at least 8 characters</p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-secondary">
                Confirm Password <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <Lock01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Link to Login */}
          <p className="mt-6 text-center text-sm text-tertiary">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-600">
              Sign in
            </Link>
          </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Signup
