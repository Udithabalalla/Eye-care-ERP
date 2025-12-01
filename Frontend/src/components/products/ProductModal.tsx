import Modal from '@/components/common/Modal'
import ProductForm from './ProductForm'
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
      size="lg"
    >
      <ProductForm
        product={product}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default ProductModal
