'use client'

/**
 * Right-side suite chips (Slack / Phoenix density).
 * Bevel mark → apex (bevel.is). Optional product chip when on an org host.
 */
import Link from 'next/link'
import { BevelNavMark } from '@/components/BevelNavMark'
import { cn } from '@bevel/ui'

const APEX =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BEVEL_PUBLIC_URL) ||
  'https://bevel.is'

export function SuiteNav({
  className,
  productLabel,
  productHref,
  showLabel = true,
  size = 'md',
}: {
  className?: string
  /** Active workspace product name (e.g. 2x4m) */
  productLabel?: string | null
  productHref?: string | null
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'h-8 gap-1.5 px-2.5 text-xs' : 'h-9 gap-2 px-3 text-sm'
  const mark = size === 'sm' ? 'size-4' : 'size-5'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Link
        href={APEX}
        className={cn(
          'inline-flex items-center rounded-full border border-white/10 bg-white/[0.06]',
          'font-medium text-foreground/90 shadow-sm backdrop-blur-sm',
          'transition hover:border-white/20 hover:bg-white/[0.1] hover:text-foreground',
          pad,
        )}
        title="BEVEL — platform home"
      >
        {/* Magenta geometry + daypart palette (crease tracks atmosphere) */}
        <BevelNavMark className={mark} />
        {showLabel ? (
          <span className="tracking-wide">BEVEL</span>
        ) : (
          <span className="sr-only">BEVEL</span>
        )}
      </Link>
      {productLabel ? (
        productHref ? (
          <Link
            href={productHref}
            className={cn(
              'inline-flex max-w-[10rem] items-center truncate rounded-full',
              'border border-white/10 bg-white/[0.04] px-3 font-medium text-muted',
              'transition hover:border-white/15 hover:text-foreground',
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
            )}
            title={productLabel}
          >
            {productLabel}
          </Link>
        ) : (
          <span
            className={cn(
              'inline-flex max-w-[10rem] items-center truncate rounded-full',
              'border border-accent/30 bg-accent/10 px-3 font-medium text-accent',
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
            )}
          >
            {productLabel}
          </span>
        )
      ) : null}
    </div>
  )
}
