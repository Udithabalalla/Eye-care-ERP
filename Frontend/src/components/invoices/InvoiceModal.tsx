import Modal from '@/components/common/Modal'
import InvoiceForm from './InvoiceForm'
import { Invoice } from '@/types/invoice.types'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice?: Invoice | null
  onSuccess: () => void
}

const InvoiceModal = ({ isOpen, onClose, invoice, onSuccess }: InvoiceModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoice ? 'Edit Invoice' : 'Create New Invoice'}
      size="xl"
    >
      <InvoiceForm
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

export default InvoiceModal
