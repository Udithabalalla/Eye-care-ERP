import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiSearchLine, RiMore2Line } from '@remixicon/react'
import toast from 'react-hot-toast'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Lenses</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Configure lens master data and pricing</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-72">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search lenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setSelectedLens(null)
                setForm(emptyForm)
                setIsModalOpen(true)
              }}
            >
              <RiAddLine className="size-4 mr-1" />
              Add Lens
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
                  <TableHead>Lens Type</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data || []).map((lens) => (
                  <TableRow key={lens.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{lens.lens_type}</p>
                        <p className="text-xs text-muted-foreground">{lens.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lens.color}</TableCell>
                    <TableCell>{lens.size}</TableCell>
                    <TableCell>{formatCurrency(lens.price)}</TableCell>
                    <TableCell>{lens.lens_code}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={lens.is_active
                          ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                          : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'}
                      >
                        {lens.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[state=open]:bg-muted"
                            aria-label="Open lens actions"
                          >
                            <RiMore2Line className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedLens(lens)
                              setIsModalOpen(true)
                            }}
                          >
                            Edit Lens
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: lens.id, is_active: !lens.is_active })}
                          >
                            {lens.is_active ? 'Deactivate Lens' : 'Activate Lens'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          setSelectedLens(null)
          setForm(emptyForm)
        }}
        title={selectedLens ? 'Edit Lens' : 'Add New Lens'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Lens Type *</label>
            <Input
              value={form.lens_type}
              onChange={(e) => setForm((current) => ({ ...current, lens_type: e.target.value }))}
              placeholder="Single Vision"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Color *</label>
              <Input
                value={form.color}
                onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))}
                placeholder="Clear"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Size *</label>
              <Input
                value={form.size}
                onChange={(e) => setForm((current) => ({ ...current, size: e.target.value }))}
                placeholder="1.50"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Price *</label>
              <Input
                type="number"
                value={String(form.price)}
                onChange={(e) => setForm((current) => ({ ...current, price: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Lens Code *</label>
              <Input
                value={form.lens_code}
                onChange={(e) => setForm((current) => ({ ...current, lens_code: e.target.value }))}
                placeholder="LN-001"
                required
              />
            </div>
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
                setSelectedLens(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <span className="mr-2 h-4 w-4 animate-spin">⟳</span>}
              {selectedLens ? 'Update Lens' : 'Create Lens'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Lenses
