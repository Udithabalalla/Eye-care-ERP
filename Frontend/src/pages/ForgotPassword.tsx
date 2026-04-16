import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Key01, Lock01, Mail01 } from '@untitledui/icons'
import toast from 'react-hot-toast'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const { requestPasswordReset, confirmPasswordReset, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isOtpSent, setIsOtpSent] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Enter your registered email address')
      return
    }

    try {
      await requestPasswordReset({ email })
      setIsOtpSent(true)
    } catch (error) {
      console.error('OTP request failed:', error)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !otp || !newPassword) {
      toast.error('Fill in the OTP and new password fields')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      await confirmPasswordReset({
        email,
        otp,
        new_password: newPassword,
      })

      navigate('/login')
    } catch (error) {
      console.error('Password reset failed:', error)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg-secondary lg:grid-cols-2">
      <section className="hidden bg-black px-10 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-apple bg-brand-600 text-lg font-semibold">EC</div>
          <h1 className="mt-8 max-w-md font-display text-[56px] font-semibold leading-[1.07] tracking-[-0.28px] text-white">
            Recover access without breaking flow.
          </h1>
          <p className="mt-4 max-w-lg text-[17px] tracking-[-0.374px] text-white/74">
            Reset passwords with a clean one-time-code flow that stays readable in both light and dark themes.
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
            <p className="mt-2 text-[17px] text-secondary">Reset your account password</p>
          </div>

          <div className="card space-y-6 bg-bg-primary ring-1 ring-border">
            <div>
              <h2 className="font-display text-[28px] font-normal leading-[1.14] tracking-[0.196px] text-primary">Password Recovery</h2>
              <p className="mt-2 text-sm text-tertiary">
              {isOtpSent
                ? 'Enter the OTP from your registered email and set a new password.'
                : 'We will send a one-time password to your registered email address.'}
              </p>
            </div>

          {!isOtpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-secondary">
                  Registered Email Address
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

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="otp" className="mb-2 block text-sm font-medium text-secondary">
                  OTP
                </label>
                <div className="relative">
                  <Key01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="input pl-10 tracking-[0.35em]"
                    disabled={isLoading}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-secondary">
                  New Password
                </label>
                <div className="relative">
                  <Lock01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="input pl-10 pr-10"
                    disabled={isLoading}
                    autoComplete="new-password"
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

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-secondary">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock01 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fg-quaternary" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="input pl-10 pr-10"
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpSent(false)
                    setOtp('')
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="btn-secondary flex-1"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-tertiary">
            Remembered your password?{' '}
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

export default ForgotPassword