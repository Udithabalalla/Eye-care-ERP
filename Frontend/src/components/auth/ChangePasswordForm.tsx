import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RiLoader4Line } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useAuthStore } from '@/store/authStore'

const schema = z
  .object({
    old_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "The passwords don't match",
    path: ['confirm_password'],
  })
  .refine((v) => v.new_password !== v.old_password, {
    message: 'Choose a password different from the current one',
    path: ['new_password'],
  })
type FormValues = z.infer<typeof schema>

interface ChangePasswordFormProps {
  /** Label for the current password, e.g. "Temporary password" */
  currentLabel?: string
  submitLabel?: string
  onDone?: () => void
  footer?: React.ReactNode
}

// Changing your password signs out your other devices (the server does that)
export function ChangePasswordForm({
  currentLabel = 'Current password',
  submitLabel = 'Change password',
  onDone,
  footer,
}: ChangePasswordFormProps) {
  const changePassword = useAuthStore((s) => s.changePassword)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await changePassword(values.old_password, values.new_password)
      form.reset()
      onDone?.()
    } catch {
      // The API error is already shown as a toast
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="old_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{currentLabel}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="new_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>At least 8 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password again</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {footer}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <RiLoader4Line className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default ChangePasswordForm
