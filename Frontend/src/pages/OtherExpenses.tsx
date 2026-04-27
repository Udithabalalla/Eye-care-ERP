import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiSearchLine, RiEditLine } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Modal from '@/components/common/Modal'
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
      if (selectedExpense) {
        return basicDataApi.updateOtherExpense(selectedExpense.id, payload)
      }
      return basicDataApi.createOtherExpense(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'other-expenses'] })
      toast.success(selectedExpense ? 'Expense updated successfully' : 'Expense created successfully')
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
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => basicDataApi.setOtherExpenseStatus(id, is_active),
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

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Other Expenses</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Configure reusable expense types for sales orders</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedExpense(null)
                setForm(emptyForm)
                setIsModalOpen(true)
              }}
            >
              <RiAddLine className="size-4 mr-1" />
              Add New Expense
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8"><Loading /></div>
          ) : (
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
                      <Badge
                        variant="outline"
                        className={expense.is_active
                          ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                          : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'}
                      >
                        {expense.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedExpense(expense)
                            setIsModalOpen(true)
                          }}
                        >
                          <RiEditLine className="size-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant={expense.is_active ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => statusMutation.mutate({ id: expense.id, is_active: !expense.is_active })}
                        >
                          {expense.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedExpense(null)
          setForm(emptyForm)
        }}
        title={selectedExpense ? 'Edit Expense' : 'Add New Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="Soldering"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Default Cost *</label>
            <Input
              type="number"
              value={String(form.default_cost)}
              onChange={(e) => setForm((current) => ({ ...current, default_cost: Number(e.target.value) }))}
              required
            />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false)
                setSelectedExpense(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <span className="mr-2 h-4 w-4 animate-spin">⟳</span>}
              {selectedExpense ? 'Update Expense' : 'Create Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default OtherExpenses
