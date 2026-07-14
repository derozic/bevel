import { cn } from '@/lib/utils'
import { BEVEL_NAME, BEVEL_TM, BEVEL_WORD } from '@/lib/bevel'

/**
 * Product wordmark: BEVEL™
 * ™ stays normal-case so tracking/uppercase only hit the letters.
 */
export function BevelMark({
  className,
  size = 'md',
  showTm = true,
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** Set false for monogram-adjacent marks if needed */
  showTm?: boolean
}) {
  const sizeClass = {
    sm: 'text-[10px] tracking-[0.22em]',
    md: 'text-xs tracking-[0.28em]',
    lg: 'text-sm tracking-[0.32em]',
  }[size]

  const tmClass = {
    sm: 'text-[8px]',
    md: 'text-[9px]',
    lg: 'text-[10px]',
  }[size]

  return (
    <span
      className={cn(
        'inline-flex items-start font-display font-semibold uppercase text-inherit',
        sizeClass,
        className,
      )}
      aria-label={BEVEL_NAME}
    >
      <span>{BEVEL_WORD}</span>
      {showTm ? (
        <span
          className={cn(
            'ml-0.5 normal-case tracking-normal font-semibold leading-none opacity-80',
            tmClass,
          )}
          aria-hidden="true"
        >
          {BEVEL_TM}
        </span>
      ) : null}
    </span>
  )
}
