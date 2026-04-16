import { Loading01 } from '@untitledui/icons'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

const Loading = ({ size = 'md', text, fullScreen = false }: LoadingProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Loading01 className={`${sizeClasses[size]} animate-spin text-brand-600`} />
      {text && <p className="text-sm text-secondary">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f5f5f7]/95">
        {content}
      </div>
    )
  }

  return content
}

export default Loading
