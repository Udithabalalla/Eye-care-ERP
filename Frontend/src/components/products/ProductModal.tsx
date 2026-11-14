import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import AddProductAssistant from './AddProductAssistant'
import { Product } from '@/types/product.types'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onSuccess: () => void
}

const ProductModal = ({ isOpen, onClose, product, onSuccess }: ProductModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <AddProductAssistant
            isOpen={isOpen}
            product={product}
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProductModal
