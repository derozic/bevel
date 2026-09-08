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
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size]

  const wordClass = {
    sm: 'tracking-[0.2em]',
    md: 'tracking-[0.24em]',
    lg: 'tracking-[0.28em]',
  }[size]

  const tmClass = {
    sm: 'text-[7.5px] -ml-[0.14em]',
    md: 'text-[8.5px] -ml-[0.16em]',
    lg: 'text-[9.5px] -ml-[0.18em]',
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
      <span className={wordClass}>{BEVEL_WORD}</span>
      {showTm ? (
        <span
          className={cn(
            'normal-case tracking-normal font-semibold leading-none opacity-80',
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
