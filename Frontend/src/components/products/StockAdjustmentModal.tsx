import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { Product } from '@/types/product.types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RiBox3Line } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  const form = useForm<StockFormValues>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      quantity: defaultValues?.quantity ?? 0,
      reason: defaultValues?.reason ?? '',
    },
  })

  const quantity = form.watch('quantity')
  const newStock = product.current_stock + (quantity || 0)

  const mutation = useMutation({
    mutationFn: (data: StockFormValues) =>
      productsApi.adjustStock(product.product_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stock adjusted successfully')
      onSuccess()
      onClose()
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || error?.message || 'Failed to adjust stock'
      toast.error(typeof msg === 'string' ? msg : 'Failed to adjust stock')
    },
  })

  const onSubmit = (data: StockFormValues) => {
    if (newStock < 0) {
      toast.error('Stock cannot be negative')
      return
    }
    mutation.mutate(data)
  }

  const stockStatusClass =
    newStock < 0
      ? 'border-destructive bg-destructive/10'
      : newStock <= product.min_stock_level
        ? 'border-warning/50 bg-warning/10'
        : 'border-success/50 bg-success/10'

  const stockTextClass =
    newStock < 0
      ? 'text-destructive'
      : newStock <= product.min_stock_level
        ? 'text-warning'
        : 'text-success'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">Adjust Stock</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Product summary */}
              <div className="rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <RiBox3Line className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock</span>
                  <span className="font-bold text-lg">{product.current_stock}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity Change <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Use negative for reduction (e.g., -5)"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Positive to add, negative to remove.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Purchase - New stock received">Purchase — New stock received</SelectItem>
                        <SelectItem value="Sale - Product sold">Sale — Product sold</SelectItem>
                        <SelectItem value="Return - Customer return">Return — Customer return</SelectItem>
                        <SelectItem value="Damaged - Product damaged">Damaged — Product damaged</SelectItem>
                        <SelectItem value="Expired - Product expired">Expired — Product expired</SelectItem>
                        <SelectItem value="Adjustment - Stock correction">Adjustment — Stock correction</SelectItem>
                        <SelectItem value="Other - See notes">Other — See notes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Optional details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* After-adjustment preview */}
              <div className={`rounded-lg border-2 p-4 ${stockStatusClass}`}>
                <p className="text-sm font-medium mb-2 text-foreground">After Adjustment</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">New Stock Level</span>
                  <span className={`text-2xl font-bold ${stockTextClass}`}>{newStock}</span>
                </div>
                {newStock < 0 && (
                  <p className="text-xs text-destructive mt-2">Stock cannot be negative.</p>
                )}
                {newStock >= 0 && newStock <= product.min_stock_level && (
                  <p className="text-xs text-warning mt-2">
                    Below minimum stock level ({product.min_stock_level}).
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending || newStock < 0}>
                  {mutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default StockAdjustmentModal
