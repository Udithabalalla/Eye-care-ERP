import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiReceiptLine } from '@remixicon/react'
import toast from 'react-hot-toast'
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
import Loading from '@/components/common/Loading'
import { basicDataApi } from '@/api/basic-data.api'
import { OtherExpenseType, OtherExpenseTypeFormData } from '@/types/basic-data.types'
import { formatCurrency } from '@/utils/formatters'

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
  const [form, setForm] = useState<OtherExpenseTypeFormData>(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['basic-data', 'other-expenses', search],
    queryFn: () => basicDataApi.getOtherExpenses({ page: 1, page_size: 100, search }),
  })

  useEffect(() => {
    if (selectedExpense) {
      setForm({
        name: selectedExpense.name,
        default_cost: selectedExpense.default_cost,
        is_active: selectedExpense.is_active,
      })
    } else {
      setForm(emptyForm)
    }
  }, [selectedExpense])

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
      setForm(emptyForm)
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      name: form.name.trim(),
      default_cost: Number(form.default_cost || 0),
      is_active: form.is_active,
    })
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedExpense(null)
    setForm(emptyForm)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Other Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Configure reusable expense types for sales orders.
          </p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedExpense(null); setForm(emptyForm); setIsModalOpen(true) }}
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
          <div className="relative w-full sm:w-72">
            <RiReceiptLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Soldering"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Default Cost *</label>
              <Input
                type="number"
                value={String(form.default_cost)}
                onChange={(e) => setForm((c) => ({ ...c, default_cost: Number(e.target.value) }))}
                required
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground cursor-pointer">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((c) => ({ ...c, is_active: checked === true }))}
              />
              Active
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <span className="mr-2 h-4 w-4 animate-spin">⟳</span>}
                {selectedExpense ? 'Update Expense' : 'Create Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OtherExpenses
