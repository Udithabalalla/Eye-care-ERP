import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold">{invoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <InvoiceForm
            invoice={invoice}
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
            onCancel={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default InvoiceModal
