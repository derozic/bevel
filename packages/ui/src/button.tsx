import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'
import { cn } from './utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'ghost' | 'outline' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild, variant = 'default', size = 'md', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-accent text-white hover:opacity-90',
          variant === 'secondary' &&
            'bg-surface text-foreground border border-border hover:bg-white/5',
          variant === 'ghost' && 'text-muted hover:bg-white/5 hover:text-foreground',
          variant === 'outline' &&
            'border border-border text-foreground hover:bg-white/5',
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-6 text-sm font-semibold',
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
