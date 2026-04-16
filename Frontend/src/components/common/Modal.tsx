import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
  className?: string
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
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }

  return (
    <div className={cn('fixed inset-0 z-50 overflow-y-auto', className)}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            'relative w-full rounded-apple-lg bg-white shadow-card transition-all',
            sizeClasses[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#d2d2d7] p-6">
            <h3 className="font-display text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-tertiary transition-colors hover:bg-[#ededf2] hover:text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end space-x-3 rounded-b-apple-lg border-t border-[#d2d2d7] bg-[#f5f5f7] p-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
