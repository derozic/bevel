import type { ReactNode } from 'react'
import Link from 'next/link'
import { BevelDaypartMark } from '@/components/BevelDaypartMark'
import { BevelMark } from '@/components/BevelMark'
import { DaypartControl } from '@/components/DaypartControl'
import { SiteFooter } from '@/components/marketing/SiteFooter'

export function PublicAtmosphere() {
  return (
    <div className="bevel-home-atmosphere" aria-hidden="true">
      <div className="bevel-home-mesh" />
      <div className="bevel-home-grid" />
    </div>
  )
}

export function ProductChrome({
  trailing,
}: {
  trailing?: ReactNode
}) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-6 py-4">
      <Link
        href="/"
        className="flex items-center gap-3 text-foreground transition hover:opacity-90"
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <BevelDaypartMark className="size-[18px]" />
        </span>
        <BevelMark size="md" />
      </Link>
      <div className="flex items-center gap-2">
        <DaypartControl compact className="hidden sm:flex" />
        {trailing}
      </div>
    </header>
  )
}

export function PublicShell({
  children,
  header,
  footer = true,
}: {
  children: ReactNode
  header?: ReactNode
  footer?: boolean
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <PublicAtmosphere />
      {header}
      <div className="relative z-10">{children}</div>
      {footer ? <SiteFooter /> : null}
    </div>
  )
}
