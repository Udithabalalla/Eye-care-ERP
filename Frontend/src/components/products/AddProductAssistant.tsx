import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RiAddLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { basicDataApi } from '@/api/basic-data.api'
import { AddProductAssistantData, Product } from '@/types/product.types'

interface AddProductAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (product?: Product) => void
  product?: Product | null
  lockedSupplierId?: string
}

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional(),
  sku: z.string().trim().min(1, 'SKU is required'),
  cost_price: z.coerce.number().min(0, 'Prices must be positive'),
  selling_price: z.coerce.number().min(0, 'Prices must be positive'),
  min_stock_level: z.coerce.number().min(0, 'Must be 0 or more'),
  supplier_id: z.string().min(1, 'Supplier is required'),
  supplier_notes: z.string().optional(),
  internal_notes: z.string().optional(),
})
type ProductFormValues = z.infer<typeof productSchema>

const defaultsFor = (product?: Product | null, lockedSupplierId?: string): ProductFormValues => ({
  name: product?.name || '',
  description: product?.description || '',
  category: product?.category || '',
  brand: product?.brand || '',
  sku: product?.sku || '',
  cost_price: product?.cost_price || 0,
  selling_price: product?.selling_price || 0,
  min_stock_level: product?.min_stock_level || 10,
  supplier_id: lockedSupplierId || '',
  supplier_notes: '',
  internal_notes: '',
})

/** A labelled read-only value (barcode, stock, supplier details) */
function ReadOnlyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 text-muted-foreground">{label}</Label>
      <Input value={value} readOnly className="bg-muted/40" />
    </div>
  )
}

const Required = () => <span className="mr-1 text-destructive">*</span>

const AddProductAssistant = ({ isOpen, onClose, onSuccess, product, lockedSupplierId }: AddProductAssistantProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => basicDataApi.getProductCategories({ page: 1, page_size: 200, is_active: true }),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesData?.data ?? []

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultsFor(product, lockedSupplierId),
  })

  // Each opening starts from the product being edited (or blank)
  useEffect(() => {
    form.reset(defaultsFor(product, lockedSupplierId))
  }, [product, isOpen, lockedSupplierId, form])

  const supplierId = form.watch('supplier_id')
  const selectedSupplier = useMemo(
    () => suppliers?.data.find((entry) => entry.id === supplierId),
    [supplierId, suppliers?.data],
  )

  const onSaved = (saved: Product, message: string) => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    toast.success(message)
    onSuccess(saved)
    onClose()
  }

  const createMutation = useMutation({
    mutationFn: (data: AddProductAssistantData) =>
      productsApi.create({ ...data, barcode: undefined, current_stock: 0, mrp: data.selling_price, supplier: data.supplier }),
    onSuccess: (created) => onSaved(created, 'Product created successfully'),
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to create product'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: AddProductAssistantData) =>
      productsApi.update(product!.product_id, {
        ...data,
        barcode: product?.barcode,
        current_stock: product?.current_stock || 0,
        mrp: data.selling_price,
        supplier: data.supplier,
      }),
    onSuccess: (updated) => onSaved(updated, 'Product updated successfully'),
    onError: () => toast.error('Failed to update product'),
  })

  const submit = (values: ProductFormValues) => {
    const payload: AddProductAssistantData = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      category: values.category,
      brand: values.brand?.trim() || undefined,
      sku: values.sku.trim(),
      cost_price: values.cost_price,
      selling_price: values.selling_price,
      min_stock_level: values.min_stock_level,
      supplier: selectedSupplier
        ? { name: selectedSupplier.supplier_name, contact: selectedSupplier.contact_person, email: selectedSupplier.email }
        : undefined,
    }
    if (product) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Product Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 px-4 md:grid-cols-8">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel><Required />Product Name</FormLabel>
                <FormControl><Input placeholder="Product Name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="Description" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel><Required />Category</FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="brand" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Brand</FormLabel>
                <FormControl><Input placeholder="Brand" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="sku" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel><Required />SKU</FormLabel>
                <FormControl><Input placeholder="SKU" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <ReadOnlyField
              className="md:col-span-4"
              label="Barcode"
              value={product?.barcode || 'Barcode will be generated automatically when the product is saved.'}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Pricing Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2">
              <FormField control={form.control} name="cost_price" render={({ field }) => (
                <FormItem>
                  <FormLabel><Required />Cost Price</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00 LKR" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="selling_price" render={({ field }) => (
                <FormItem>
                  <FormLabel><Required />Selling Price</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00 LKR" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Inventory Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2">
              <ReadOnlyField label="Current Stock" value={product ? String(product.current_stock) : '0'} />
              <FormField control={form.control} name="min_stock_level" render={({ field }) => (
                <FormItem>
                  <FormLabel><Required />Min Stock Level</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
        </div>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 px-4 md:grid-cols-8">
            {lockedSupplierId ? (
              <ReadOnlyField className="md:col-span-2" label="Supplier" value={selectedSupplier?.supplier_name || ''} />
            ) : (
              <FormField control={form.control} name="supplier_id" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel><Required />Supplier</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select an option" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.data.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.supplier_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <ReadOnlyField
              className="md:col-span-2"
              label="Supplier Contact"
              value={selectedSupplier?.contact_person || product?.supplier?.contact || ''}
            />
            <ReadOnlyField className="md:col-span-2" label="Supplier Person" value={selectedSupplier?.contact_person || ''} />
            <ReadOnlyField className="md:col-span-4" label="Supplier Address" value={selectedSupplier?.address || ''} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 px-4">
            <FormField control={form.control} name="supplier_notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Notes</FormLabel>
                <FormControl><Input placeholder="Notes" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="internal_notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Internal Notes</FormLabel>
                <FormControl><Input placeholder="Notes" {...field} /></FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : <RiAddLine />}
            {product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default AddProductAssistant
