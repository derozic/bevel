'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BEVEL_HOME_PATH } from '@/lib/bevel'
import { BevelMark } from './BevelMark'

export function BevelNavLink() {
  const pathname = usePathname()
  const active = pathname.startsWith('/bevel') || pathname.startsWith('/chat')

  return (
    <Link
      href={BEVEL_HOME_PATH}
      className={cn(
        'inline-flex items-center rounded-lg px-3 py-1.5 transition-colors',
        active
          ? 'btn-primary-ink'
          : 'border border-ink-200 bg-surface text-ink hover:border-ink'
      )}
    >
      <BevelMark size="sm" />
    </Link>
  )
}