import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiArrowGoBackLine, RiDeleteBin6Line, RiEditLine, RiStethoscopeLine } from '@remixicon/react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import Loading from '@/components/common/Loading'
import { useConfirm } from '@/hooks/useConfirm'
import { TESTERS_QUERY_KEY } from '@/hooks/useTestedBy'
import { testersApi, type Tester } from '@/api/testers.api'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name (at least 2 letters)').max(80, 'Keep it under 80 characters'),
  title: z.string().trim().max(60, 'Keep it under 60 characters').optional(),
})
type FormValues = z.infer<typeof schema>

const errorText = (error: any, fallback: string) => {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

/** Settings → Tested By: the names offered under "Tested by" on a sales order */
const TestedBySettings = () => {
  const queryClient = useQueryClient()
  const { confirm, confirmDialog } = useConfirm()
  const [editing, setEditing] = useState<Tester | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', title: '' } })

  const { data: testers, isLoading } = useQuery({ queryKey: TESTERS_QUERY_KEY, queryFn: () => testersApi.getAll() })
  const listed = (testers ?? []).filter((t) => t.is_active)
  const removed = (testers ?? []).filter((t) => !t.is_active)

  useEffect(() => {
    if (dialogOpen) form.reset({ name: editing?.name ?? '', title: editing?.title ?? '' })
  }, [dialogOpen, editing, form])

  const refresh = () => queryClient.invalidateQueries({ queryKey: TESTERS_QUERY_KEY })

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { name: values.name.trim(), title: values.title?.trim() || null }
      return editing ? testersApi.update(editing.id, payload) : testersApi.create(payload)
    },
    onSuccess: (tester) => {
      refresh()
      toast.success(editing ? `${tester.name} updated` : `${tester.name} added to Tested by`)
      setDialogOpen(false)
    },
    onError: (error) => toast.error(errorText(error, 'Could not save the name')),
  })

  const statusMutation = useMutation({
    mutationFn: ({ tester, active }: { tester: Tester; active: boolean }) => testersApi.setActive(tester.id, active),
    onSuccess: (tester) => {
      refresh()
      toast.success(tester.is_active ? `${tester.name} is back on the list` : `${tester.name} removed from Tested by`)
    },
    onError: (error) => toast.error(errorText(error, 'Could not update the list')),
  })

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (tester: Tester) => { setEditing(tester); setDialogOpen(true) }

  const remove = async (tester: Tester) => {
    const ok = await confirm({
      title: `Remove ${tester.name}?`,
      description: 'They will no longer be offered under "Tested by". Orders they already tested keep their name, and you can restore them later.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      destructive: true,
    })
    if (ok) statusMutation.mutate({ tester, active: false })
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tested By</h1>
          <p className="text-sm text-muted-foreground">
            The people staff pick from under "Tested by" when they take a sales order.
          </p>
        </div>
        <Button size="sm" className="w-full md:w-auto" onClick={openAdd}>
          <RiAddLine className="size-4" />
          Add person
        </Button>
      </section>

      {!isLoading && listed.length === 0 && (
        <Alert variant="info">
          <RiStethoscopeLine />
          <AlertTitle>No names added yet</AlertTitle>
          <AlertDescription>
            Until you add someone, "Tested by" lists the staff accounts. Once the list has names, only these are offered.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">On the list</CardTitle>
              <CardDescription>Listed A to Z in the order wizard.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">{listed.length} listed</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : listed.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Nobody yet. Add the optometrists and staff who test patients.</p>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listed.map((tester) => (
                    <TableRow key={tester.id}>
                      <TableCell className="font-medium text-foreground">{tester.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tester.title || '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(tester)} aria-label={`Edit ${tester.name}`}>
                            <RiEditLine className="size-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(tester)}
                            disabled={statusMutation.isPending}
                            aria-label={`Remove ${tester.name}`}
                          >
                            <RiDeleteBin6Line className="size-4" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {removed.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Removed</CardTitle>
            <CardDescription>Not offered on new orders. Past orders still show their name.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto px-6">
              <Table>
                <TableBody>
                  {removed.map((tester) => (
                    <TableRow key={tester.id}>
                      <TableCell className="text-muted-foreground">{tester.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tester.title || '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ tester, active: true })}
                            disabled={statusMutation.isPending}
                          >
                            <RiArrowGoBackLine className="size-4" />
                            Restore
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add to Tested by'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Orders they already tested show the new name too.' : 'They will be offered under "Tested by" on new sales orders.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Nimal Perera" autoFocus {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Optometrist" {...field} value={field.value ?? ''} /></FormControl>
                  <FormDescription>Shown under the name in the picker.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Spinner />}
                  {editing ? 'Save changes' : 'Add person'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TestedBySettings
