import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { Product } from '@/types/product.types'
import Modal from '@/components/common/Modal'
import toast from 'react-hot-toast'
import { Package } from 'lucide-react'

const stockSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  notes: z.string().optional(),
})

type StockFormValues = z.infer<typeof stockSchema>

interface StockAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  onSuccess: () => void
  defaultValues?: {
    quantity?: number
    reason?: string
  }
}

const StockAdjustmentModal = ({
  isOpen,
  onClose,
  product,
  onSuccess,
  defaultValues,
}: StockAdjustmentModalProps) => {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockFormValues>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      quantity: defaultValues?.quantity ?? 0,
      reason: defaultValues?.reason ?? '',
    },
  })

  const quantity = watch('quantity')
  const newStock = product.current_stock + quantity

  const mutation = useMutation({
    mutationFn: (data: StockFormValues) =>
      productsApi.adjustStock(product.product_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock adjusted successfully')
      onSuccess()
      onClose()
    },
    onError: () => {
      toast.error('Failed to adjust stock')
    },
  })

  const onSubmit = (data: StockFormValues) => {
    if (newStock < 0) {
      toast.error('Stock cannot be negative')
      return
    }
    mutation.mutate(data)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust Stock" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Product Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Package className="w-8 h-8 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">{product.name}</h3>
              <p className="text-sm text-gray-600">SKU: {product.sku}</p>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current Stock:</span>
            <span className="font-bold text-lg">{product.current_stock}</span>
          </div>
        </div>

        {/* Quantity Adjustment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity Change *
          </label>
          <input
            type="number"
            {...register('quantity', { valueAsNumber: true })}
            className="input"
            placeholder="Use negative for reduction (e.g., -5)"
          />
          {errors.quantity && (
            <p className="text-sm text-red-600 mt-1">{errors.quantity.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Positive to add, negative to remove
          </p>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason *
          </label>
          <select {...register('reason')} className="input">
            <option value="">Select reason</option>
            <option value="Purchase - New stock received">
              Purchase - New stock received
            </option>
            <option value="Sale - Product sold">Sale - Product sold</option>
            <option value="Return - Customer return">Return - Customer return</option>
            <option value="Damaged - Product damaged">Damaged - Product damaged</option>
            <option value="Expired - Product expired">Expired - Product expired</option>
            <option value="Adjustment - Stock correction">
              Adjustment - Stock correction
            </option>
            <option value="Other - See notes">Other - See notes</option>
          </select>
          {errors.reason && (
            <p className="text-sm text-red-600 mt-1">{errors.reason.message}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea {...register('notes')} rows={2} className="input" />
        </div>

        {/* Preview */}
        <div
          className={`p-4 rounded-lg border-2 ${newStock < 0
              ? 'bg-red-50 border-red-200'
              : newStock <= product.min_stock_level
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}
        >
          <p className="text-sm font-medium mb-2">After Adjustment:</p>
          <div className="flex justify-between items-center">
            <span className="text-sm">New Stock Level:</span>
            <span
              className={`text-2xl font-bold ${newStock < 0
                  ? 'text-red-600'
                  : newStock <= product.min_stock_level
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}
            >
              {newStock}
            </span>
          </div>
          {newStock < 0 && (
            <p className="text-xs text-red-600 mt-2">⚠️ Stock cannot be negative!</p>
          )}
          {newStock >= 0 && newStock <= product.min_stock_level && (
            <p className="text-xs text-yellow-600 mt-2">
              ⚠️ Below minimum stock level ({product.min_stock_level})
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || newStock < 0}
            className="btn-primary"
          >
            {isSubmitting ? 'Adjusting...' : 'Adjust Stock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default StockAdjustmentModal
