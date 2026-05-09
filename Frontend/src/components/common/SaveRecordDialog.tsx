import { RiSaveLine } from '@remixicon/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SaveRecordDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  recordName?: string
  isCreating?: boolean
  confirmLabel?: string
  onSaveDraft?: () => void
  onCancel?: () => void
}

export function SaveRecordDialog({
  isOpen,
  onOpenChange,
  recordName = 'record',
  isCreating = true,
  confirmLabel = 'Save as Draft',
  onSaveDraft,
  onCancel,
}: SaveRecordDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
            <RiSaveLine className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Save {recordName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {isCreating
              ? `Are you sure you want to save this new ${recordName}? You can save it as a draft for later.`
              : `Are you sure you want to save the changes to this ${recordName}? You can save it as a draft for later.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="outline" onClick={onCancel}>
            Discard
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSaveDraft} variant="default">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default SaveRecordDialog
