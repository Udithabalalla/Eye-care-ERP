import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { basicDataApi } from '@/api/basic-data.api'
import { ProductCategory, ProductCategoryFormData } from '@/types/basic-data.types'
import {
  RiAddLine,
  RiEditLine,
  RiSearchLine,
  RiSettings4Line,
  RiMoreLine,
  RiCheckLine,
  RiCloseLine,
} from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import toast from 'react-hot-toast'

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  color: z.string().optional(),
  is_active: z.boolean().default(true),
})

type CategoryFormValues = z.infer<typeof categorySchema>

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1',
]

interface CategoryDialogProps {
  open: boolean
  onClose: () => void
  category?: ProductCategory | null
}

const CategoryDialog = ({ open, onClose, category }: CategoryDialogProps) => {
  const queryClient = useQueryClient()

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { name: category.name, description: category.description ?? '', color: category.color ?? '', is_active: category.is_active }
      : { name: '', description: '', color: DEFAULT_COLORS[0], is_active: true },
  })

  // Reset when category changes
  useState(() => {
    if (open) {
      form.reset(
        category
          ? { name: category.name, description: category.description ?? '', color: category.color ?? '', is_active: category.is_active }
          : { name: '', description: '', color: DEFAULT_COLORS[0], is_active: true }
      )
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: ProductCategoryFormData) => basicDataApi.createProductCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      toast.success('Category created')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProductCategoryFormData>) => basicDataApi.updateProductCategory(category!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      toast.success('Category updated')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to update category'),
  })

  const onSubmit = (values: CategoryFormValues) => {
    if (category) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add Product Category'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Frame Case, Carry Bag, Accessories" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input {...field} placeholder="Optional description" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem>
                <FormLabel>Badge Color</FormLabel>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className="h-7 w-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: field.value === c ? 'hsl(var(--foreground))' : 'transparent',
                        transform: field.value === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="cursor-pointer font-normal">Active</FormLabel>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : category ? 'Save Changes' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const ProductCategories = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<ProductCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['product-categories', search],
    queryFn: () => basicDataApi.getProductCategories({ page: 1, page_size: 100, search: search || undefined }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setProductCategoryStatus(id, is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-categories'] }),
    onError: () => toast.error('Failed to update status'),
  })

  const openAdd = () => { setSelected(null); setDialogOpen(true) }
  const openEdit = (cat: ProductCategory) => { setSelected(cat); setDialogOpen(true) }

  const categories = data?.data ?? []

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Product Categories</h1>
          <p className="text-sm text-muted-foreground">Define categories for your products — used across the product catalogue.</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <RiAddLine className="size-4" />
          Add Category
        </Button>
      </section>

      <Card className="border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>{data?.total ?? 0} categories defined</CardDescription>
            </div>
            <Badge variant="secondary">{categories.filter((c) => c.is_active).length} active</Badge>
          </div>
          <div className="relative w-full max-w-xs">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RiSettings4Line className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No categories yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create categories like "Frame Case", "Carry Bag", "Frames"</p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <RiAddLine className="size-4" />
                Add First Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        )}
                        <span className="font-medium text-foreground">{cat.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{cat.description || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={cat.is_active ? 'default' : 'secondary'} className="text-xs">
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0">
                            <RiMoreLine className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(cat)}>
                            <RiEditLine className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: cat.id, is_active: !cat.is_active })}
                          >
                            {cat.is_active ? (
                              <><RiCloseLine className="size-4 mr-2" />Deactivate</>
                            ) : (
                              <><RiCheckLine className="size-4 mr-2" />Activate</>
                            )}
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

      <CategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        category={selected}
      />
    </div>
  )
}

export default ProductCategories
