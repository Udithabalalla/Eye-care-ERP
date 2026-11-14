import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiAddLine, RiMore2Line, RiSparklingLine } from '@remixicon/react'
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
import { LensMaster, LensMasterFormData } from '@/types/basic-data.types'
import { formatCurrency } from '@/utils/formatters'

const required = (message: string) => z.string().trim().min(1, message)
const lensSchema = z.object({
  lens_type: required('Enter the lens type'),
  color: required('Enter the colour'),
  size: required('Enter the size'),
  price: z.coerce.number({ invalid_type_error: 'Enter the price' }).min(0, 'Enter 0 or more'),
  lens_code: required('Enter the lens code'),
  is_active: z.boolean(),
})

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
  const form = useForm<LensMasterFormData>({ resolver: zodResolver(lensSchema), defaultValues: emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['basic-data', 'lenses', search],
    queryFn: () => basicDataApi.getLenses({ page: 1, page_size: 100, search }),
  })

  useEffect(() => {
    form.reset(selectedLens
      ? {
          lens_type: selectedLens.lens_type,
          color: selectedLens.color,
          size: selectedLens.size,
          price: selectedLens.price,
          lens_code: selectedLens.lens_code,
          is_active: selectedLens.is_active,
        }
      : emptyForm)
  }, [selectedLens, form])

  const saveMutation = useMutation({
    mutationFn: async (payload: LensMasterFormData) => {
      if (selectedLens) return basicDataApi.updateLens(selectedLens.id, payload)
      return basicDataApi.createLens(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'lenses'] })
      toast.success(selectedLens ? 'Lens updated' : 'Lens created')
      setIsModalOpen(false)
      setSelectedLens(null)
      form.reset(emptyForm)
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || 'Failed to save lens'
      toast.error(typeof message === 'string' ? message : 'Failed to save lens')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setLensStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'lenses'] })
      toast.success('Lens status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const submit = (values: LensMasterFormData) =>
    saveMutation.mutate({
      lens_type: values.lens_type.trim(),
      color: values.color.trim(),
      size: values.size.trim(),
      price: Number(values.price || 0),
      lens_code: values.lens_code.trim(),
      is_active: values.is_active,
    })

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedLens(null)
    form.reset(emptyForm)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lenses</h1>
          <p className="text-sm text-muted-foreground">Configure lens master data and pricing.</p>
        </div>
        <Button
          size="sm"
          className="w-full md:w-auto"
          onClick={() => { setSelectedLens(null); form.reset(emptyForm); setIsModalOpen(true) }}
        >
          <RiAddLine className="size-4" />
          Add Lens
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Lens Records</CardTitle>
              <CardDescription>Manage lens types and their pricing.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {data?.total || 0} total
            </Badge>
          </div>
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon><RiSparklingLine /></InputGroupAddon>
            <InputGroupInput placeholder="Search lenses..." aria-label="Search lenses" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                        <Badge variant={lens.is_active ? 'default' : 'outline'}>
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => { setSelectedLens(lens); setIsModalOpen(true) }}
                            >
                              Edit Lens
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({ id: lens.id, is_active: !lens.is_active })
                              }
                            >
                              {lens.is_active ? 'Deactivate' : 'Activate'}
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
            <DialogTitle>{selectedLens ? 'Edit Lens' : 'Add New Lens'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <FormField control={form.control} name="lens_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lens Type *</FormLabel>
                  <FormControl><Input placeholder="Single Vision" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color *</FormLabel>
                  <FormControl><Input placeholder="Clear" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="size" render={({ field }) => (
                <FormItem>
                  <FormLabel>Size *</FormLabel>
                  <FormControl><Input placeholder="1.50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lens_code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lens Code *</FormLabel>
                  <FormControl><Input placeholder="LN-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              </div>
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
                  {selectedLens ? 'Update Lens' : 'Create Lens'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Lenses
