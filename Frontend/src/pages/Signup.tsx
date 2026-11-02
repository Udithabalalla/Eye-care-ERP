import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  RiUserLine,
  RiMailLine,
  RiPhoneLine,
  RiLockLine,
  RiEyeLine,
  RiEyeOffLine,
  RiKeyLine,
  RiAlertLine,
  RiLoader4Line,
} from '@remixicon/react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ROLE_OPTIONS } from '@/lib/access'
import type { UserRole } from '@/types/common.types'

// Matches PASSWORD_RESET_RESEND_SECONDS on the API: it won't send a new code sooner
const RESEND_SECONDS = 60

const roleValues = ROLE_OPTIONS.map((r) => r.value) as [string, ...string[]]

const ROLE_HINTS: Record<string, string> = {
  admin: 'Full access, including managing users, roles and who is signed in.',
  doctor: 'Patients, prescriptions, appointments and sales.',
  optometrist: 'Patients, prescriptions, appointments and sales.',
  receptionist: 'Front counter work plus payments and finance.',
  staff: 'Front counter work plus inventory, purchasing and finance.',
}

const detailsSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email address'),
    role: z.enum(roleValues),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const codeSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

type DetailsValues = z.infer<typeof detailsSchema>
type CodeValues = z.infer<typeof codeSchema>

const Signup = () => {
  const navigate = useNavigate()
  const { signup, verifySignup, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  // The details are kept so "Send a new code" can start the sign-up again
  const [pending, setPending] = useState<DetailsValues | null>(null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const detailsForm = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: '', email: '', role: 'staff', phone: '', password: '', confirmPassword: '' },
  })
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { otp: '' } })
  const role = detailsForm.watch('role')

  const sendCode = async (values: DetailsValues) => {
    try {
      await signup({
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role as UserRole,
        password: values.password,
        phone: values.phone?.trim() || undefined,
      })
      setPending(values)
      setResendIn(RESEND_SECONDS)
    } catch {
      // The API's reason is shown as a toast
    }
  }

  const onVerify = async (values: CodeValues) => {
    if (!pending) return
    try {
      await verifySignup(pending.email.trim(), values.otp)
      navigate('/')
    } catch {
      codeForm.setValue('otp', '')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(var(--accent)/0.16),transparent_28%),radial-gradient(circle_at_60%_80%,hsl(var(--secondary)/0.4),transparent_36%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg items-center justify-center p-4 md:p-8">
        <Card className="w-full border-border/60 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <span className="text-lg font-bold text-primary-foreground">EC</span>
              </div>
              <p className="text-xs text-muted-foreground">Eye Care ERP</p>
            </div>
            <CardTitle className="text-xl">{pending ? 'Check your email' : 'Create account'}</CardTitle>
            <CardDescription>
              {pending ? (
                <>We sent a 6-digit code to <span className="font-medium text-foreground">{pending.email}</span>. Enter it to finish.</>
              ) : (
                'Fill in your details. We email you a code to confirm your address.'
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!pending ? (
              // Distinct keys: otherwise React reuses the first form's field for the code box
              <Form key="details" {...detailsForm}>
                <form onSubmit={detailsForm.handleSubmit(sendCode)} className="space-y-4">
                  <FormField
                    control={detailsForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiUserLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Your name" className="pl-8" autoComplete="name" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiMailLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="email" placeholder="you@example.com" className="pl-8" autoComplete="email" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{ROLE_HINTS[field.value ?? 'staff']}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {role === 'admin' && (
                    <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                      <RiAlertLine className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      An admin can see everything and manage every account. You confirm your email with a code first.
                    </p>
                  )}
                  <FormField
                    control={detailsForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiPhoneLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="tel" placeholder="07X XXX XXXX" className="pl-8" autoComplete="tel" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={detailsForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="At least 8 characters"
                              className="pl-8 pr-8"
                              autoComplete="new-password"
                              disabled={isLoading}
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
                    control={detailsForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password again</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type={showPassword ? 'text' : 'password'} className="pl-8" autoComplete="new-password" disabled={isLoading} {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <RiLoader4Line className="size-4 animate-spin" />}
                    Send confirmation code
                  </Button>
                </form>
              </Form>
            ) : (
              <Form key="code" {...codeForm}>
                <form onSubmit={codeForm.handleSubmit(onVerify)} className="space-y-4">
                  <FormField
                    control={codeForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmation code</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <RiKeyLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="6-digit code"
                              className="pl-8 tracking-[0.35em]"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              autoFocus
                              disabled={isLoading}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            />
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Didn&apos;t get it? Check spam, or{' '}
                          {resendIn > 0 ? (
                            <span>ask for a new code in {resendIn}s.</span>
                          ) : (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs"
                              disabled={isLoading}
                              onClick={() => sendCode(pending)}
                            >
                              send a new code
                            </Button>
                          )}
                        </FormDescription>
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
                        setPending(null)
                        codeForm.reset()
                      }}
                    >
                      Change details
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading && <RiLoader4Line className="size-4 animate-spin" />}
                      Create account
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            <Separator className="my-5" />

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
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

export default Signup
