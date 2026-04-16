import { forwardRef } from 'react'
import { cn } from '@/utils/helpers'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="mb-1.5 block text-[14px] font-semibold tracking-[-0.224px] text-secondary">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "w-full rounded-apple-md border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-[17px] tracking-[-0.374px] text-primary placeholder-tertiary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-error-500 focus:border-error-500 focus:ring-error-500/20",
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-error-500">{error}</p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export default Input
