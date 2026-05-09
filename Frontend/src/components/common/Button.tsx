import { forwardRef } from 'react'
import { RiLoader4Line } from '@remixicon/react'
import { cn } from '@/utils/helpers'
import { Button as ShadButton } from '@/components/ui/button'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const variants: Record<NonNullable<ButtonProps['variant']>, 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'> = {
            primary: 'default',
            secondary: 'secondary',
            outline: 'outline',
            ghost: 'ghost',
            danger: 'destructive',
        }

        const sizes: Record<NonNullable<ButtonProps['size']>, 'sm' | 'default' | 'lg'> = {
            sm: 'sm',
            md: 'default',
            lg: 'lg',
        }

        return (
            <ShadButton
                ref={ref}
                disabled={disabled || isLoading}
                variant={variants[variant]}
                size={sizes[size]}
                className={cn(
                    className
                )}
                {...props}
            >
                {isLoading && <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </ShadButton>
        )
    }
)

Button.displayName = 'Button'

export default Button

