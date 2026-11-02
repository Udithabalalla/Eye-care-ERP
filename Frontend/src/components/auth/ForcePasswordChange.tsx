import { RiLockLine, RiLogoutBoxRLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import ChangePasswordForm from './ChangePasswordForm'

// Shown instead of the app until someone replaces a password an admin set for them.
// The API refuses every other request from them until they do.
const ForcePasswordChange = () => {
  const { user, logout } = useAuthStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="space-y-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiLockLine className="size-5" />
          </span>
          <CardTitle className="text-xl">Choose your own password</CardTitle>
          <CardDescription>
            {user?.name ? `${user.name}, an` : 'An'} administrator set your password. Replace it with one only
            you know to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm
            currentLabel="Password you signed in with"
            submitLabel="Save and continue"
            footer={
              <Button type="button" variant="ghost" onClick={() => logout()}>
                <RiLogoutBoxRLine className="size-4" />
                Sign out
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default ForcePasswordChange
