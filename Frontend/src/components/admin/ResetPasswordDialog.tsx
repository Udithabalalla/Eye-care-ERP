import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RiLoader4Line } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usersApi, type AdminUser } from '@/api/users.api'

const schema = z
  .object({
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string(),
    must_change_password: z.boolean(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "The passwords don't match",
    path: ['confirm_password'],
  })
type FormValues = z.infer<typeof schema>

interface ResetPasswordDialogProps {
  user: AdminUser | null
  onClose: () => void
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '', confirm_password: '', must_change_password: true },
  })

  useEffect(() => {
    if (user) form.reset({ new_password: '', confirm_password: '', must_change_password: true })
  }, [user, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.resetPassword(user!.user_id, values.new_password, values.must_change_password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(`New password set for ${user?.name}`)
      onClose()
    },
  })

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            For {user?.name}. They are signed out on every device and sign in again with this password.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
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
                  <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="must_change_password"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-md border border-border p-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="font-normal">Ask them to choose their own password next time</FormLabel>
                    <FormDescription>Recommended, so only they know it.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                Set password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default ResetPasswordDialog
