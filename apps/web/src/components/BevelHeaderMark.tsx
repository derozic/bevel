'use client'

/**
 * BEVEL suite mark for the chat header trailing cluster —
 * immediately left of the user avatar (never next to the product logo).
 */
import Link from 'next/link'
import { BevelNavMark } from '@/components/BevelNavMark'
import { platformPublicUrl } from '@/lib/platform'
import { cn } from '@bevel/ui'

export function BevelHeaderMark({
  className,
  href,
  title = 'BEVEL — platform home',
}: {
  className?: string
  /** Defaults to apex bevel.is */
  href?: string
  title?: string
}) {
  const target = href || platformPublicUrl()

  return (
    <Link
      href={target}
      className={cn(
        'bevel-header-mark',
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full',
        'border border-[color-mix(in_srgb,var(--ink,#111827)_14%,transparent)]',
        'bg-[color-mix(in_srgb,var(--surface,#fff)_88%,transparent)]',
        'text-ink transition hover:border-[color-mix(in_srgb,var(--ink,#111827)_28%,transparent)]',
        'hover:bg-[var(--surface,#fff)]',
        className,
      )}
      title={title}
      aria-label="BEVEL"
    >
      <BevelNavMark className="size-4" />
      <span className="sr-only">BEVEL</span>
    </Link>
  )
}
