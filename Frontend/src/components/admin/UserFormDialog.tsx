import { useEffect, useMemo } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ROLE_OPTIONS } from '@/lib/access'
import { usersApi, type AdminUser } from '@/api/users.api'

const roleValues = ROLE_OPTIONS.map((r) => r.value) as [string, ...string[]]

const baseSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name'),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(roleValues),
  department: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  must_change_password: z.boolean(),
})
type FormValues = z.infer<typeof baseSchema>

interface UserFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this user; create a new one when left out */
  user?: AdminUser | null
  currentUserId?: string
}

export function UserFormDialog({ open, onClose, user, currentUserId }: UserFormDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!user
  const isSelf = isEdit && user?.user_id === currentUserId

  const schema = useMemo(
    () =>
      isEdit
        ? baseSchema
        : baseSchema.refine((v) => (v.password ?? '').length >= 8, {
            message: 'Use at least 8 characters',
            path: ['password'],
          }),
    [isEdit],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: 'staff', department: '', phone: '', password: '', must_change_password: true },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'staff',
      department: user?.department ?? '',
      phone: user?.phone ?? '',
      password: '',
      must_change_password: true,
    })
  }, [open, user, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const details = {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        department: values.department?.trim() ?? '',
        phone: values.phone?.trim() ?? '',
      }
      if (isEdit && user) {
        // The API refuses to change your own role, so don't send it
        return usersApi.updateUser(user.user_id, isSelf ? { ...details, role: undefined } : details)
      }
      return usersApi.createUser({
        ...details,
        password: values.password ?? '',
        must_change_password: values.must_change_password,
      })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(isEdit ? `${saved.name} updated` : `Account created for ${saved.name}`)
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${user?.name}` : 'Add a user'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'A new role takes effect on their next action.'
              : 'They sign in with this email and the password you set.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl><Input autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" autoComplete="off" {...field} /></FormControl>
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
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf && <FormDescription>You can't change your own role.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input type="tel" placeholder="Optional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!isEdit && (
              <>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                      <FormDescription>At least 8 characters. Give it to them in person, not by email.</FormDescription>
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
                        <FormLabel className="font-normal">Ask them to choose their own password when they first sign in</FormLabel>
                        <FormDescription>Until they do, they can't use anything else.</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <RiLoader4Line className="size-4 animate-spin" />}
                {isEdit ? 'Save changes' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default UserFormDialog
