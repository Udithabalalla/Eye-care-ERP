import { forwardRef } from 'react'
import { Loading01 } from '@untitledui/icons'
import { cn } from '@/utils/helpers'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-xs',
            secondary: 'bg-[#1d1d1f] text-white hover:bg-black',
            outline: 'border border-brand-700 bg-transparent text-brand-700 hover:underline',
            ghost: 'bg-transparent text-primary hover:bg-[#ededf2]',
            danger: 'bg-error-600 text-white hover:bg-error-700 shadow-xs',
        }

        const sizes = {
            sm: 'h-8 px-3 text-[14px]',
            md: 'h-10 px-4 text-[17px]',
            lg: 'h-12 px-6 text-[18px]',
        }

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    "inline-flex items-center justify-center rounded-apple font-normal tracking-[-0.374px] transition-all focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:opacity-50 disabled:cursor-not-allowed",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {isLoading && <Loading01 className="w-4 h-4 mr-2 animate-spin" />}
                {children}
            </button>
        )
    }
)

Button.displayName = 'Button'

export default Button
