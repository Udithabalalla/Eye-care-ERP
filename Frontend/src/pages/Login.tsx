import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLockLine,
  RiMailLine,
  RiSparklingLine,
  RiShieldCheckLine,
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
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'

const Login = () => {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const applyDemoCredentials = (role: 'admin' | 'doctor' | 'receptionist') => {
    const credentials = {
      admin: { email: 'admin@eyecare.com', password: 'admin123' },
      doctor: { email: 'doctor@eyecare.com', password: 'doctor123' },
      receptionist: { email: 'receptionist@eyecare.com', password: 'reception123' },
    }

    setEmail(credentials[role].email)
    setPassword(credentials[role].password)
  }

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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(var(--accent)/0.16),transparent_28%),radial-gradient(circle_at_60%_80%,hsl(var(--secondary)/0.4),transparent_36%)]" />

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
              <form onSubmit={handleSubmit} className="space-y-4">
                <FieldGroup>
                  <FieldSet>
                    <Field>
                      <FieldLabel htmlFor="email">Email address</FieldLabel>
                      <div className="relative">
                        <RiMailLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@eyecare.com"
                          className="pl-8"
                          disabled={isLoading}
                          autoComplete="email"
                          required
                        />
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <div className="relative">
                        <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-8 pr-8"
                          disabled={isLoading}
                          autoComplete="current-password"
                          required
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

              <Card className="mt-5 border-dashed">
                <CardContent className="space-y-2 pt-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    <RiShieldCheckLine className="mr-1 inline size-3.5" />
                    Demo credentials
                  </p>
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyDemoCredentials('admin')}
                      className="justify-start"
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyDemoCredentials('doctor')}
                      className="justify-start"
                    >
                      Doctor
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyDemoCredentials('receptionist')}
                      className="justify-start"
                    >
                      Receptionist
                    </Button>
                  </div>
                  <p>Click a role to autofill email and password.</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Login