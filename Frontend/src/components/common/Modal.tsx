import { cn } from '@/utils/helpers'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
  className?: string
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  className,
}: ModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto p-0',
          sizeClasses[size],
          className
        )}
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-bold text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="p-6">{children}</div>

        {footer && (
          <div className="flex items-center justify-end space-x-3 rounded-b-xl border-t border-border bg-muted/30 px-6 py-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
