import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SearchLg, Edit01 } from '@untitledui/icons'
import toast from 'react-hot-toast'
import { Table, TableCard, Input, BadgeWithDot, Button } from '@/components/ui'
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
      <TableCard.Root>
        <TableCard.Header
          title="Other Expenses"
          badge={data?.total || 0}
          description="Configure reusable expense types for sales orders"
          contentTrailing={(
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                className="w-full sm:w-72"
              />
              <Button
                onClick={() => {
                  setSelectedExpense(null)
                  setForm(emptyForm)
                  setIsModalOpen(true)
                }}
                iconLeading={Plus}
              >
                Add New Expense
              </Button>
            </div>
          )}
        />

        {isLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table aria-label="Other expenses table">
            <Table.Header>
              <Table.Head label="Name" isRowHeader />
              <Table.Head label="Default Cost" />
              <Table.Head label="Status" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body items={data?.data || []}>
              {(expense) => (
                <Table.Row id={expense.id}>
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-primary">{expense.name}</p>
                      <p className="text-xs text-tertiary">{expense.id}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{formatCurrency(expense.default_cost)}</Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot size="sm" color={expense.is_active ? 'success' : 'error'}>
                      {expense.is_active ? 'Active' : 'Inactive'}
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Button
                        color="link-gray"
                        size="sm"
                        iconLeading={Edit01}
                        onClick={() => {
                          setSelectedExpense(expense)
                          setIsModalOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        color={expense.is_active ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: expense.id, is_active: !expense.is_active })}
                      >
                        {expense.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </TableCard.Root>

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
          <Input
            label="Name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="Soldering"
            isRequired
          />
          <Input
            label="Default Cost"
            type="number"
            
            value={String(form.default_cost)}
            onChange={(value) => setForm((current) => ({ ...current, default_cost: Number(value) }))}
            isRequired
          />
          <label className="flex items-center gap-3 rounded-xl border border-secondary bg-secondary/20 px-4 py-3 text-sm text-primary">
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
              color="secondary"
              onClick={() => {
                setIsModalOpen(false)
                setSelectedExpense(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {selectedExpense ? 'Update Expense' : 'Create Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default OtherExpenses
