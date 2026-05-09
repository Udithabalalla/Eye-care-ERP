import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { Product, ProductFormData } from '@/types/product.types'
import { ProductCategory } from '@/types/common.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.nativeEnum(ProductCategory),
  brand: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  cost_price: z.number().min(0, 'Cost price must be positive'),
  selling_price: z.number().min(0, 'Selling price must be positive'),
  mrp: z.number().min(0, 'MRP must be positive'),
  current_stock: z.number().min(0, 'Stock cannot be negative'),
  min_stock_level: z.number().min(0, 'Min stock level must be positive'),
  supplier: z.object({
    name: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
  product?: Product | null
  onSuccess: () => void
  onCancel: () => void
}

const inputClass = 'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'

const ProductForm = ({ product, onSuccess, onCancel }: ProductFormProps) => {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          sku: product.sku,
          barcode: product.barcode,
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          mrp: product.mrp,
          current_stock: product.current_stock,
          min_stock_level: product.min_stock_level,
          supplier: product.supplier,
        }
      : {
          current_stock: 0,
          min_stock_level: 10,
        },
  })

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to create product')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProductFormData>) =>
      productsApi.update(product!.product_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update product')
    },
  })

  const onSubmit = (data: ProductFormValues) => {
    if (product) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data as ProductFormData)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Product Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Product Name *
            </label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-sm text-error-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Description
            </label>
            <textarea {...register('description')} rows={2} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Category *
            </label>
            <select {...register('category')} className={inputClass}>
              <option value="">Select category</option>
              <option value="contact-lenses">Contact Lenses</option>
              <option value="eyeglasses">Eyeglasses</option>
              <option value="frames">Frames</option>
              <option value="sunglasses">Sunglasses</option>
              <option value="eye-drops">Eye Drops</option>
              <option value="accessories">Accessories</option>
            </select>
            {errors.category && (
              <p className="text-sm text-error-600 mt-1">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Brand</label>
            <Input {...register('brand')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">SKU *</label>
            <Input {...register('sku')} placeholder="e.g., CLS-360" />
            {errors.sku && (
              <p className="text-sm text-error-600 mt-1">{errors.sku.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Barcode</label>
            {product?.barcode ? (
              <Input value={product.barcode} className="bg-secondary/60" readOnly />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                Barcode will be generated automatically when the product is saved.
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Cost Price *
            </label>
            <Input
              type="number"
              step="0.01"
              {...register('cost_price', { valueAsNumber: true })}
            />
            {errors.cost_price && (
              <p className="text-sm text-error-600 mt-1">{errors.cost_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Selling Price *
            </label>
            <Input
              type="number"
              step="0.01"
              {...register('selling_price', { valueAsNumber: true })}
            />
            {errors.selling_price && (
              <p className="text-sm text-error-600 mt-1">{errors.selling_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">MRP *</label>
            <Input
              type="number"
              step="0.01"
              {...register('mrp', { valueAsNumber: true })}
            />
            {errors.mrp && (
              <p className="text-sm text-error-600 mt-1">{errors.mrp.message}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Inventory</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Current Stock *
            </label>
            <Input
              type="number"
              {...register('current_stock', { valueAsNumber: true })}
              disabled={!!product}
            />
            {errors.current_stock && (
              <p className="text-sm text-error-600 mt-1">{errors.current_stock.message}</p>
            )}
            {product && (
              <p className="text-xs text-muted-foreground mt-1">
                Use stock adjustment to change quantity
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Min Stock Level *
            </label>
            <Input
              type="number"
              {...register('min_stock_level', { valueAsNumber: true })}
            />
            {errors.min_stock_level && (
              <p className="text-sm text-error-600 mt-1">{errors.min_stock_level.message}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Supplier Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Supplier Name
            </label>
            <Input {...register('supplier.name')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Contact
            </label>
            <Input {...register('supplier.contact')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
            <Input type="email" {...register('supplier.email')} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  )
}

export default ProductForm
