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
} from '@remixicon/react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { UserRole } from '@/types/common.types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const signupSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type SignupFormValues = z.infer<typeof signupSchema>

const Signup = () => {
  const navigate = useNavigate()
  const { signup, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: UserRole.STAFF,
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    try {
      await signup({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        phone: values.phone || undefined,
      })
      navigate('/')
    } catch (error) {
      console.error('Signup failed:', error)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.12),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(var(--accent)/0.16),transparent_28%),radial-gradient(circle_at_60%_80%,hsl(var(--secondary)/0.4),transparent_36%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg items-center justify-center p-4 md:p-8">
        <Card className="w-full border-border/60 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
                <span className="text-lg font-bold text-primary-foreground">EC</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Eye Care ERP</p>
              </div>
            </div>
            <CardTitle className="text-xl">Create account</CardTitle>
            <CardDescription>Fill in your details to get started.</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <RiUserLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input placeholder="John Doe" className="pl-8" disabled={isLoading} {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <RiMailLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="email" placeholder="you@example.com" className="pl-8" disabled={isLoading} autoComplete="email" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number <span className="text-muted-foreground">(optional)</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <RiPhoneLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="tel" placeholder="+1 (555) 000-0000" className="pl-8" disabled={isLoading} {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UserRole.STAFF}>Staff</SelectItem>
                          <SelectItem value={UserRole.RECEPTIONIST}>Receptionist</SelectItem>
                          <SelectItem value={UserRole.OPTOMETRIST}>Optometrist</SelectItem>
                          <SelectItem value={UserRole.DOCTOR}>Doctor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
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
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <RiLockLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
            </Form>

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
