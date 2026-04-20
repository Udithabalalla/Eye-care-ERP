import { forwardRef } from 'react'
import { cn } from '@/utils/helpers'
import { Input as ShadInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <Label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                        {label}
                    </Label>
                )}
                <ShadInput
                    ref={ref}
                    className={cn(
                        'h-10 px-3 text-sm',
                        error && 'border-destructive focus-visible:ring-destructive/30',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-destructive">{error}</p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export default Input

