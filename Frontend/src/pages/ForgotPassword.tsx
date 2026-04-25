import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  RiMailLine,
  RiKeyLine,
  RiLockLine,
  RiEyeLine,
  RiEyeOffLine,
} from '@remixicon/react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

const resetSchema = z
  .object({
    otp: z.string().length(6, 'OTP must be 6 digits'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type EmailFormValues = z.infer<typeof emailSchema>
type ResetFormValues = z.infer<typeof resetSchema>

const ForgotPassword = () => {
  const navigate = useNavigate()
  const { requestPasswordReset, confirmPasswordReset, isLoading } = useAuthStore()
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  })

  const onRequestOtp = async (values: EmailFormValues) => {
    try {
      await requestPasswordReset({ email: values.email })
      setEmail(values.email)
      setIsOtpSent(true)
    } catch (error) {
      console.error('OTP request failed:', error)
    }
  }

  const onResetPassword = async (values: ResetFormValues) => {
    try {
      await confirmPasswordReset({
        email,
        otp: values.otp,
        new_password: values.newPassword,
      })
      navigate('/login')
    } catch (error) {
      console.error('Password reset failed:', error)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(var(--accent)/0.16),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-4 md:p-8">
        <Card className="w-full border-border/60 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <span className="text-lg font-bold text-primary-foreground">EC</span>
              </div>
            </div>
            <CardTitle className="text-xl">Password recovery</CardTitle>
            <CardDescription>
              {isOtpSent
                ? 'Enter the OTP from your registered email and set a new password.'
                : 'We will send a one-time password to your registered email address.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!isOtpSent ? (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onRequestOtp)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registered email address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiMailLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="admin@eyecare.com"
                              className="pl-8"
                              disabled={isLoading}
                              autoComplete="email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
                  <FormField
                    control={resetForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>One-time password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiKeyLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Enter 6-digit code"
                              className="pl-8 tracking-[0.35em]"
                              disabled={isLoading}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))
                              }
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resetForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="New password"
                              className="pl-8 pr-8"
                              disabled={isLoading}
                              autoComplete="new-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resetForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Confirm password"
                              className="pl-8"
                              disabled={isLoading}
                              autoComplete="new-password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={isLoading}
                      onClick={() => {
                        setIsOtpSent(false)
                        resetForm.reset()
                      }}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? 'Resetting...' : 'Reset password'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            <Separator className="my-5" />

            <p className="text-center text-xs text-muted-foreground">
              Remembered your password?{' '}
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/login">Sign in</Link>
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ForgotPassword
