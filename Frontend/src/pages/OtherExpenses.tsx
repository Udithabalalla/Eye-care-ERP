import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiReceiptLine } from '@remixicon/react'
import { toast } from 'sonner'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import Loading from '@/components/common/Loading'
import { basicDataApi } from '@/api/basic-data.api'
import { OtherExpenseType, OtherExpenseTypeFormData } from '@/types/basic-data.types'
import { formatCurrency } from '@/utils/formatters'

const expenseSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  default_cost: z.coerce.number({ invalid_type_error: 'Enter the default cost' }).min(0, 'Enter 0 or more'),
  is_active: z.boolean(),
})

const emptyForm: OtherExpenseTypeFormData = {
  name: '',
  default_cost: 0,
  is_active: true,
}

const OtherExpenses = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<OtherExpenseType | null>(null)
  const form = useForm<OtherExpenseTypeFormData>({ resolver: zodResolver(expenseSchema), defaultValues: emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['basic-data', 'other-expenses', search],
    queryFn: () => basicDataApi.getOtherExpenses({ page: 1, page_size: 100, search }),
  })

  useEffect(() => {
    form.reset(selectedExpense
      ? { name: selectedExpense.name, default_cost: selectedExpense.default_cost, is_active: selectedExpense.is_active }
      : emptyForm)
  }, [selectedExpense, form])

  const saveMutation = useMutation({
    mutationFn: async (payload: OtherExpenseTypeFormData) => {
      if (selectedExpense) return basicDataApi.updateOtherExpense(selectedExpense.id, payload)
      return basicDataApi.createOtherExpense(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'other-expenses'] })
      toast.success(selectedExpense ? 'Expense updated' : 'Expense created')
      setIsModalOpen(false)
      setSelectedExpense(null)
      form.reset(emptyForm)
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || 'Failed to save expense'
      toast.error(typeof message === 'string' ? message : 'Failed to save expense')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setOtherExpenseStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'other-expenses'] })
      toast.success('Expense status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const submit = (values: OtherExpenseTypeFormData) =>
    saveMutation.mutate({
      name: values.name.trim(),
      default_cost: Number(values.default_cost || 0),
      is_active: values.is_active,
    })

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedExpense(null)
    form.reset(emptyForm)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Charge Types</h1>
          <p className="text-sm text-muted-foreground">
            Extra services you can add to a sales order, like soldering, with a default cost.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedExpense(null); form.reset(emptyForm); setIsModalOpen(true) }}
        >
          <RiAddLine className="size-4" />
          Add Expense
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Expense Types</CardTitle>
              <CardDescription>Manage reusable expense types.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon><RiReceiptLine /></InputGroupAddon>
            <InputGroupInput placeholder="Search expenses..." aria-label="Search expenses" value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
            <div className="overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Default Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data || []).map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{expense.name}</p>
                          <p className="text-xs text-muted-foreground">{expense.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(expense.default_cost)}</TableCell>
                      <TableCell>
                        <Badge variant={expense.is_active ? 'default' : 'outline'}>
                          {expense.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="data-[state=open]:bg-muted"
                              aria-label="Open expense actions"
                            >
                              <RiMore2Line className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => { setSelectedExpense(expense); setIsModalOpen(true) }}
                            >
                              Edit Expense
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({ id: expense.id, is_active: !expense.is_active })
                              }
                            >
                              {expense.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input placeholder="Soldering" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="default_cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Cost *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    </FormControl>
                    Active
                  </label>
                </FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Spinner />}
                  {selectedExpense ? 'Update Expense' : 'Create Expense'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OtherExpenses
