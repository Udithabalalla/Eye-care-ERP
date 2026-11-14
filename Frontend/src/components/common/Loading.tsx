import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

const sizeClasses = {
  sm: 'size-4',
  md: 'size-8',
  lg: 'size-12',
}

const Loading = ({ size = 'md', text, fullScreen = false }: LoadingProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Spinner className={cn(sizeClasses[size], 'text-primary')} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 dark:bg-background/95">
        {content}
      </div>
    )
  }

  return content
}

export default Loading
