import { cn } from '@/lib/utils'
import { BEVEL_NAME } from '@/lib/bevel'

export function BevelMark({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = {
    sm: 'text-[10px] tracking-[0.22em]',
    md: 'text-xs tracking-[0.28em]',
    lg: 'text-sm tracking-[0.32em]',
  }[size]

  return (
    <span
      className={cn(
        'font-display font-semibold uppercase text-inherit',
        sizeClass,
        className
      )}
      aria-label={BEVEL_NAME}
    >
      {BEVEL_NAME}
    </span>
  )
}