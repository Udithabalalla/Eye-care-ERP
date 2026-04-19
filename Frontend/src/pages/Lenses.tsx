import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SearchLg, Edit01 } from '@untitledui/icons'
import toast from 'react-hot-toast'
import { Table, TableCard, Input, BadgeWithDot, Button } from '@/components/ui'
import Modal from '@/components/common/Modal'
import Loading from '@/components/common/Loading'
import { basicDataApi } from '@/api/basic-data.api'
import { LensMaster, LensMasterFormData } from '@/types/basic-data.types'
import { formatCurrency } from '@/utils/formatters'

const emptyForm: LensMasterFormData = {
  lens_type: '',
  color: '',
  size: '',
  price: 0,
  lens_code: '',
  is_active: true,
}

const Lenses = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedLens, setSelectedLens] = useState<LensMaster | null>(null)
  const [form, setForm] = useState<LensMasterFormData>(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['basic-data', 'lenses', search],
    queryFn: () => basicDataApi.getLenses({ page: 1, page_size: 100, search }),
  })

  useEffect(() => {
    if (selectedLens) {
      setForm({
        lens_type: selectedLens.lens_type,
        color: selectedLens.color,
        size: selectedLens.size,
        price: selectedLens.price,
        lens_code: selectedLens.lens_code,
        is_active: selectedLens.is_active,
      })
    } else {
      setForm(emptyForm)
    }
  }, [selectedLens])

  const saveMutation = useMutation({
    mutationFn: async (payload: LensMasterFormData) => {
      if (selectedLens) {
        return basicDataApi.updateLens(selectedLens.id, payload)
      }
      return basicDataApi.createLens(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'lenses'] })
      toast.success(selectedLens ? 'Lens updated successfully' : 'Lens created successfully')
      setIsModalOpen(false)
      setSelectedLens(null)
      setForm(emptyForm)
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || 'Failed to save lens'
      toast.error(typeof message === 'string' ? message : 'Failed to save lens')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => basicDataApi.setLensStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'lenses'] })
      toast.success('Lens status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      lens_type: form.lens_type.trim(),
      color: form.color.trim(),
      size: form.size.trim(),
      price: Number(form.price || 0),
      lens_code: form.lens_code.trim(),
      is_active: form.is_active,
    })
  }

  return (
    <div className="space-y-6">
      <TableCard.Root>
        <TableCard.Header
          title="Lenses"
          badge={data?.total || 0}
          description="Configure lens master data and pricing"
          contentTrailing={(
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Input
                placeholder="Search lenses..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                className="w-full sm:w-72"
              />
              <Button
                onClick={() => {
                  setSelectedLens(null)
                  setForm(emptyForm)
                  setIsModalOpen(true)
                }}
                iconLeading={Plus}
              >
                Add Lens
              </Button>
            </div>
          )}
        />

        {isLoading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : (
          <Table aria-label="Lenses table">
            <Table.Header>
              <Table.Head label="Lens Type" isRowHeader />
              <Table.Head label="Color" />
              <Table.Head label="Size" />
              <Table.Head label="Price" />
              <Table.Head label="Code" />
              <Table.Head label="Status" />
              <Table.Head label="Actions" />
            </Table.Header>
            <Table.Body items={data?.data || []}>
              {(lens) => (
                <Table.Row id={lens.id}>
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-primary">{lens.lens_type}</p>
                      <p className="text-xs text-tertiary">{lens.id}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{lens.color}</Table.Cell>
                  <Table.Cell>{lens.size}</Table.Cell>
                  <Table.Cell>{formatCurrency(lens.price)}</Table.Cell>
                  <Table.Cell>{lens.lens_code}</Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot size="sm" color={lens.is_active ? 'success' : 'error'}>
                      {lens.is_active ? 'Active' : 'Inactive'}
                    </BadgeWithDot>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Button
                        color="link-gray"
                        size="sm"
                        iconLeading={Edit01}
                        onClick={() => {
                          setSelectedLens(lens)
                          setIsModalOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        color={lens.is_active ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: lens.id, is_active: !lens.is_active })}
                      >
                        {lens.is_active ? 'Deactivate' : 'Activate'}
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
          setSelectedLens(null)
          setForm(emptyForm)
        }}
        title={selectedLens ? 'Edit Lens' : 'Add New Lens'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Lens Type"
            value={form.lens_type}
            onChange={(value) => setForm((current) => ({ ...current, lens_type: value }))}
            placeholder="Single Vision"
            isRequired
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Color"
              value={form.color}
              onChange={(value) => setForm((current) => ({ ...current, color: value }))}
              placeholder="Clear"
              isRequired
            />
            <Input
              label="Size"
              value={form.size}
              onChange={(value) => setForm((current) => ({ ...current, size: value }))}
              placeholder="1.50"
              isRequired
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Price"
              type="number"
              
              value={String(form.price)}
              onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))}
              isRequired
            />
            <Input
              label="Lens Code"
              value={form.lens_code}
              onChange={(value) => setForm((current) => ({ ...current, lens_code: value }))}
              placeholder="LN-001"
              isRequired
            />
          </div>
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
                setSelectedLens(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {selectedLens ? 'Update Lens' : 'Create Lens'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Lenses
