import Modal from '@/components/common/Modal'
import PaymentForm from './PaymentForm'
import { Invoice } from '@/types/invoice.types'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: Invoice
  onSuccess: () => void
}

const PaymentModal = ({ isOpen, onClose, invoice, onSuccess }: PaymentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      size="md"
    >
      <PaymentForm
        invoice={invoice}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default PaymentModal
