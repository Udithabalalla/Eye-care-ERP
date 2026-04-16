import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Lock01, Mail01 } from '@untitledui/icons'
import toast from 'react-hot-toast'

const Login = () => {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    try {
      await login({ email, password })
      navigate('/')
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#f5f5f7] lg:grid-cols-2">
      <section className="hidden bg-black px-10 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-apple bg-brand-600 text-lg font-semibold">
            EC
          </div>
          <h1 className="mt-8 max-w-md font-display text-[56px] font-semibold leading-[1.07] tracking-[-0.28px] text-white">
            Precision workflow for optical clinics.
          </h1>
          <p className="mt-4 max-w-lg text-[17px] tracking-[-0.374px] text-white/74">
            Manage patients, appointments, diagnostics, inventory, and billing from a unified ERP tuned for eye care operations.
          </p>
        </div>
        <p className="text-[12px] text-white/55">Eye Care ERP • Apple-inspired clinical interface</p>
      </section>

      <section className="flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-apple bg-brand-600">
            <span className="text-white font-bold text-2xl">EC</span>
          </div>
          <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-0.28px] text-primary">Vision Optical</h1>
          <p className="mt-2 text-[17px] text-secondary">Institute Management System</p>
        </div>

        {/* Login Card */}
        <div className="card bg-white ring-1 ring-[#d2d2d7]">
          <h2 className="mb-6 font-display text-[28px] font-normal leading-[1.14] tracking-[0.196px] text-primary">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@eyecare.com"
                  className="input pl-10"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">
                Password
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
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-fg-quaternary hover:text-fg-secondary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
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
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Link to Sign Up */}
          <p className="mt-6 text-center text-sm text-tertiary">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-700 hover:text-brand-600">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-sm text-tertiary">
            <Link to="/forgot-password" className="font-semibold text-brand-700 hover:text-brand-600">
              Forgot your password?
            </Link>
          </p>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 rounded-apple bg-white p-5 ring-1 ring-[#d2d2d7]">
          <h3 className="mb-2 text-sm font-semibold text-primary">Demo Credentials</h3>
          <div className="space-y-1 text-xs text-secondary">
            <p><strong>Admin:</strong> admin@eyecare.com / admin123</p>
            <p><strong>Doctor:</strong> doctor@eyecare.com / doctor123</p>
            <p><strong>Receptionist:</strong> receptionist@eyecare.com / reception123</p>
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}

export default Login
