import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'
import { cn } from './utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild, variant = 'default', size = 'md', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bevel-accent)] disabled:opacity-50',
          variant === 'default' &&
            'bg-[var(--bevel-accent)] text-white hover:opacity-90',
          variant === 'ghost' && 'hover:bg-white/5 text-[var(--bevel-text)]',
          variant === 'outline' &&
            'border border-[var(--bevel-border)] text-[var(--bevel-text)] hover:bg-white/5',
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-11 px-6',
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'