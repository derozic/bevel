'use client'

/**
 * Bevel mark → apex (bevel.is). Workspace switching lives in ChatHeaderTools.
 */
import Link from 'next/link'
import { BevelNavMark } from '@/components/BevelNavMark'
import { platformPublicUrl } from '@/lib/platform'
import { cn } from '@bevel/ui'

/** Canonical platform apex — always bevel.is (never org host). */
const APEX = platformPublicUrl()

export function SuiteNav({
  className,
  showLabel = true,
  size = 'md',
}: {
  className?: string
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
        <BevelNavMark className={mark} />
        {showLabel ? (
          <span className="tracking-wide">BEVEL</span>
        ) : (
          <span className="sr-only">BEVEL</span>
        )}
      </Link>
    </div>
  )
}
