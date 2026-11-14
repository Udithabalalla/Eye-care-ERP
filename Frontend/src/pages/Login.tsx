import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLockLine,
  RiMailLine,
  RiSparklingLine,
} from '@remixicon/react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type LoginValues = z.infer<typeof loginSchema>

const Login = () => {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  // The auth store shows the error toast when the API refuses the login
  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values)
      navigate('/')
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_35%),radial-gradient(circle_at_85%_20%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_28%),radial-gradient(circle_at_60%_80%,color-mix(in_oklab,var(--secondary)_40%,transparent),transparent_36%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 md:p-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden lg:block">
            <Badge variant="secondary" className="mb-4">
              <RiSparklingLine className="size-3" />
              Eye Care ERP
            </Badge>
            <h1 className="max-w-lg text-4xl font-semibold leading-tight text-foreground">
              Practice operations, inventory, and billing in one workspace.
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Built on semantic design tokens with a consistent, scalable UI system.
            </p>
          </section>

          <Card className="border-border/60 bg-card/95 backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>
                Use your account credentials to access the dashboard.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FieldGroup>
                  <FieldSet>
                    <Field data-invalid={!!errors.email}>
                      <FieldLabel htmlFor="email">Email address</FieldLabel>
                      <div className="relative">
                        <RiMailLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-8"
                          disabled={isLoading}
                          autoComplete="email"
                          aria-invalid={!!errors.email}
                          {...register('email')}
                        />
                      </div>
                      <FieldError errors={[errors.email]} />
                    </Field>

                    <Field data-invalid={!!errors.password}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <div className="relative">
                        <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="pl-8 pr-8"
                          disabled={isLoading}
                          autoComplete="current-password"
                          aria-invalid={!!errors.password}
                          {...register('password')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <RiEyeOffLine className="size-4" />
                          ) : (
                            <RiEyeLine className="size-4" />
                          )}
                        </Button>
                      </div>
                      <FieldError errors={[errors.password]} />
                    </Field>
                  </FieldSet>
                </FieldGroup>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <Separator className="my-5" />

              <div className="space-y-2 text-center text-xs text-muted-foreground">
                <p>
                  Don&apos;t have an account?{' '}
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link to="/signup">Create one</Link>
                  </Button>
                </p>
                <p>
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link to="/forgot-password">Forgot your password?</Link>
                  </Button>
                </p>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Login