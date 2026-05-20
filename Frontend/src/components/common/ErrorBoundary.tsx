import React from 'react'

type State = { hasError: boolean; error?: Error }

type Props = {
  children?: React.ReactNode
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console so developer can inspect stack
    // In future, send to remote error tracking
    console.error('ErrorBoundary caught error', error, info)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-md border border-destructive bg-destructive/10">
          <h3 className="text-lg font-semibold text-destructive">Something went wrong</h3>
          <p className="mt-2 text-sm text-muted-foreground">The Sales Order Assistant failed to load. Check the console for details.</p>
          {this.state.error && (
            <pre className="mt-3 max-h-48 overflow-auto text-xs text-muted-foreground">{String(this.state.error.stack || this.state.error.message)}</pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
