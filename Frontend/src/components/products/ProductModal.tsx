import Modal from '@/components/common/Modal'
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      size="xl"
    >
      <AddProductAssistant
        isOpen={isOpen}
        product={product}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
        onClose={onClose}
      />
    </Modal>
  )
}

export default ProductModal
