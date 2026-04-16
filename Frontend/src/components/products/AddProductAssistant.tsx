import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus } from '@untitledui/icons'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import { productsApi } from '@/api/products.api'
import { suppliersApi } from '@/api/suppliers.api'
import { AddProductAssistantData, Product } from '@/types/product.types'
import { ProductCategory } from '@/types/common.types'

interface AddProductAssistantProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (product?: Product) => void
  product?: Product | null
  lockedSupplierId?: string
}

type FormState = AddProductAssistantData & {
  supplier_id: string
  supplier_contact: string
  supplier_email: string
  supplier_address: string
  supplier_notes: string
  internal_notes: string
}

const categoryOptions: Array<{ value: ProductCategory; label: string }> = [
  { value: ProductCategory.CONTACT_LENSES, label: 'Contact Lenses' },
  { value: ProductCategory.EYEGLASSES, label: 'Eyeglasses' },
  { value: ProductCategory.FRAMES, label: 'Frames' },
  { value: ProductCategory.SUNGLASSES, label: 'Sunglasses' },
  { value: ProductCategory.EYE_DROPS, label: 'Eye Drops' },
  { value: ProductCategory.ACCESSORIES, label: 'Accessories' },
]

const createDefaultState = (product?: Product | null): FormState => ({
  name: product?.name || '',
  description: product?.description || '',
  category: product?.category || ProductCategory.ACCESSORIES,
  brand: product?.brand || '',
  sku: product?.sku || '',
  cost_price: product?.cost_price || 0,
  selling_price: product?.selling_price || 0,
  min_stock_level: product?.min_stock_level || 10,
  supplier_id: '',
  supplier_contact: product?.supplier?.contact || '',
  supplier_email: product?.supplier?.email || '',
  supplier_address: '',
  supplier_notes: '',
  internal_notes: '',
})

const AddProductAssistant = ({ isOpen, onClose, onSuccess, product, lockedSupplierId }: AddProductAssistantProps) => {
  const queryClient = useQueryClient()
  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll({ page: 1, page_size: 100 }) })
  const [form, setForm] = useState<FormState>(createDefaultState(product))

  useEffect(() => {
    setForm(createDefaultState(product))
  }, [product, isOpen])

  useEffect(() => {
    if (!lockedSupplierId) return
    setForm((current) => ({ ...current, supplier_id: lockedSupplierId }))
  }, [lockedSupplierId])

  useEffect(() => {
    const selectedSupplier = suppliers?.data.find((entry) => entry.id === form.supplier_id)
    if (!selectedSupplier) return

    setForm((current) => ({
      ...current,
      supplier_contact: selectedSupplier.contact_person || '',
      supplier_email: selectedSupplier.email || '',
      supplier_address: selectedSupplier.address || '',
    }))
  }, [form.supplier_id, suppliers?.data])

  const selectedSupplier = useMemo(
    () => suppliers?.data.find((entry) => entry.id === form.supplier_id),
    [form.supplier_id, suppliers?.data],
  )

  const createMutation = useMutation({
    mutationFn: (data: AddProductAssistantData) => productsApi.create({
      ...data,
      barcode: undefined,
      current_stock: 0,
      mrp: data.selling_price,
      supplier: data.supplier,
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created successfully')
      onSuccess(created)
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create product'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: AddProductAssistantData) => productsApi.update(product!.product_id, {
      ...data,
      barcode: product?.barcode,
      current_stock: product?.current_stock || 0,
      mrp: data.selling_price,
      supplier: data.supplier,
    }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated successfully')
      onSuccess(updated)
      onClose()
    },
    onError: () => toast.error('Failed to update product'),
  })

  const submit = () => {
    if (!form.name.trim()) return toast.error('Product name is required')
    if (!form.category) return toast.error('Category is required')
    if (!form.sku.trim()) return toast.error('SKU is required')
    if (!form.supplier_id) return toast.error('Supplier is required')
    if (form.cost_price < 0 || form.selling_price < 0) return toast.error('Prices must be positive')

    const payload: AddProductAssistantData = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      category: form.category,
      brand: form.brand?.trim() || undefined,
      sku: form.sku.trim(),
      cost_price: Number(form.cost_price),
      selling_price: Number(form.selling_price),
      min_stock_level: Number(form.min_stock_level),
      supplier: selectedSupplier
        ? {
            name: selectedSupplier.supplier_name,
            contact: selectedSupplier.contact_person,
            email: selectedSupplier.email,
          }
        : undefined,
    }

    if (product) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-primary">Product Information</h4>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Product Name</label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product Name" />
          </div>
          <div className="md:col-span-4">
            <label className="mb-2 block text-sm font-medium text-secondary">Description</label>
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Category</label>
            <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary">Brand</label>
            <Input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Brand" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>SKU</label>
            <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="SKU" />
          </div>
          <div className="md:col-span-4">
            <label className="mb-2 block text-sm font-medium text-secondary">Barcode</label>
            <Input value={product?.barcode || 'Barcode will be generated automatically when the product is saved.'} readOnly />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">Pricing Information</h4>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Cost Price</label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={(event) => setForm({ ...form, cost_price: Number(event.target.value) })} placeholder="Qty" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Selling Price</label>
              <Input type="number" step="0.01" value={form.selling_price} onChange={(event) => setForm({ ...form, selling_price: Number(event.target.value) })} placeholder="0.00 LKR" />
            </div>
          </div>
        </div>

        <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">Inventory Information</h4>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">Current Stock</label>
              <Input value={product ? String(product.current_stock) : '0'} readOnly />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Min Stock Level</label>
              <Input type="number" value={form.min_stock_level} onChange={(event) => setForm({ ...form, min_stock_level: Number(event.target.value) })} placeholder="0.00 LKR" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-primary">Supplier Information</h4>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-8">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary"><span className="mr-1 text-error-500">*</span>Supplier</label>
            {lockedSupplierId ? (
              <Input value={selectedSupplier?.supplier_name || ''} readOnly />
            ) : (
              <select className="input" value={form.supplier_id} onChange={(event) => setForm({ ...form, supplier_id: event.target.value })}>
                <option value="">Select an option</option>
                {suppliers?.data.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary">Supplier Contact</label>
            <Input value={form.supplier_contact || selectedSupplier?.contact_person || ''} readOnly />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary">Supplier Person</label>
            <Input value={selectedSupplier?.contact_person || ''} readOnly />
          </div>
          <div className="md:col-span-4">
            <label className="mb-2 block text-sm font-medium text-secondary">Supplier Address</label>
            <Input value={selectedSupplier?.address || form.supplier_address || ''} readOnly />
          </div>
        </div>
      </div>

      <div className="rounded-apple-lg border border-border bg-bg-primary p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-primary">Notes</h4>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Input label="Supplier Notes" value={form.supplier_notes} onChange={(event) => setForm({ ...form, supplier_notes: event.target.value })} placeholder="Notes" />
          <Input label="Internal Notes" value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} placeholder="Notes" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
          <span className="mr-2 inline-flex items-center"> <Plus className="h-4 w-4" /> </span>
          {product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  )
}

export default AddProductAssistant