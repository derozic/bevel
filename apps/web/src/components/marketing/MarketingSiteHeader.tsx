import Link from 'next/link'
import type { ReactNode } from 'react'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { Button } from '@bevel/ui'
import { BevelDaypartMark } from '@/components/BevelDaypartMark'
import { BevelMark } from '@/components/BevelMark'
import { DaypartControl } from '@/components/DaypartControl'
import { MARKETING_NAV, signedInProductHome } from '@/lib/marketing'

export type MarketingSiteHeaderActions = 'home' | 'claim' | 'marketing'

export type MarketingSiteHeaderProps = {
  /** Preset right-side CTAs; pass a node for full custom actions */
  actions?: MarketingSiteHeaderActions | ReactNode
  signedIn?: boolean
  /** Display name / email when signed in */
  userLabel?: string | null
  /** Home primary CTA (e.g. Claim workspace) when signed out */
  primaryHref?: string
  primaryLabel?: string
  /** Signed-in product home. Apex defaults to Private (`/me`). */
  productHref?: string
  productLabel?: string
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 text-foreground transition hover:opacity-90"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
        <BevelDaypartMark className="size-[18px]" />
      </span>
      <BevelMark size="md" />
    </Link>
  )
}

function MarketingNavLinks({ hideOn = 'md' }: { hideOn?: 'sm' | 'md' }) {
  const hideClass = hideOn === 'sm' ? 'hidden sm:inline-flex' : 'hidden md:inline-flex'
  return (
    <>
      {MARKETING_NAV.map((item) => (
        <Button
          key={item.href}
          asChild
          variant="ghost"
          size="sm"
          className={hideClass}
        >
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </>
  )
}

function HomeActions({
  signedIn,
  userLabel,
  primaryHref = '/claim',
  primaryLabel = 'Claim workspace',
  productHref,
  productLabel,
}: {
  signedIn?: boolean
  userLabel?: string | null
  primaryHref?: string
  primaryLabel?: string
  productHref?: string
  productLabel?: string
}) {
  if (signedIn) {
    const home = signedInProductHome()
    return (
      <>
        {userLabel ? (
          <span className="hidden max-w-[10rem] truncate text-sm text-muted sm:inline">
            {userLabel}
          </span>
        ) : null}
        <Button asChild size="md">
          <Link href={productHref ?? home.href}>{productLabel ?? home.label}</Link>
        </Button>
      </>
    )
  }
  return (
    <>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/login?callbackUrl=%2Fwelcome">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">
        <Link href={primaryHref}>{primaryLabel}</Link>
      </Button>
    </>
  )
}

function ClaimActions({
  signedIn,
  userLabel,
  productHref,
  productLabel,
}: {
  signedIn?: boolean
  userLabel?: string | null
  productHref?: string
  productLabel?: string
}) {
  if (signedIn) {
    const home = signedInProductHome()
    return (
      <>
        {userLabel ? (
          <span className="hidden max-w-[12rem] truncate text-sm text-muted sm:inline">
            {userLabel}
          </span>
        ) : null}
        <Button asChild size="md">
          <Link href={productHref ?? home.href}>{productLabel ?? home.label}</Link>
        </Button>
      </>
    )
  }
  // Already on /claim — one clear path: sign in returns here to finish claim.
  return (
    <Button asChild variant="outline" size="md">
      <Link href="/login?callbackUrl=%2Fclaim">Sign in</Link>
    </Button>
  )
}

function MarketingActions({
  signedIn,
  userLabel,
  productHref,
  productLabel,
}: {
  signedIn?: boolean
  userLabel?: string | null
  productHref?: string
  productLabel?: string
}) {
  if (signedIn) {
    const home = signedInProductHome()
    return (
      <>
        {userLabel ? (
          <span className="hidden max-w-[10rem] truncate text-sm text-muted sm:inline">
            {userLabel}
          </span>
        ) : null}
        <Button asChild size="sm" className="shrink-0">
          <Link href={productHref ?? home.href}>{productLabel ?? home.label}</Link>
        </Button>
      </>
    )
  }
  return (
    <>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/login?callbackUrl=%2Fwelcome">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">
        <Link href="/claim">Claim workspace</Link>
      </Button>
    </>
  )
}

function MobileNav({ hideOn = 'md' }: { hideOn?: 'sm' | 'md' }) {
  const hideClass = hideOn === 'sm' ? 'sm:hidden' : 'md:hidden'
  return (
    <details className={`relative ${hideClass}`}>
      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-surface text-foreground [&::-webkit-details-marker]:hidden">
        <Bars3Icon className="size-5" aria-hidden />
        <span className="sr-only">Menu</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface p-2 shadow-xl">
        <div className="px-1 pb-2">
          <DaypartControl compact />
        </div>
        {MARKETING_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  )
}

/**
 * Shared marketing site header: cut-mark logo + BEVEL wordmark + nav + CTAs.
 * Used on home, claim, and static marketing pages for consistent chrome.
 */
export function MarketingSiteHeader({
  actions = 'marketing',
  signedIn = false,
  userLabel = null,
  primaryHref = '/claim',
  primaryLabel = 'Claim workspace',
  productHref,
  productLabel,
}: MarketingSiteHeaderProps) {
  const navHide = actions === 'marketing' ? 'sm' : 'md'

  let trailing: ReactNode
  if (typeof actions !== 'string') {
    trailing = actions
  } else if (actions === 'home') {
    trailing = (
      <HomeActions
        signedIn={signedIn}
        userLabel={userLabel}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        productHref={productHref}
        productLabel={productLabel}
      />
    )
  } else if (actions === 'claim') {
    trailing = (
      <ClaimActions
        signedIn={signedIn}
        userLabel={userLabel}
        productHref={productHref}
        productLabel={productLabel}
      />
    )
  } else {
    trailing = (
      <MarketingActions
        signedIn={signedIn}
        userLabel={userLabel}
        productHref={productHref}
        productLabel={productLabel}
      />
    )
  }

  return (
    <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5">
      <BrandLink />
      <nav className="flex flex-nowrap items-center justify-end gap-1 sm:gap-2">
        <MarketingNavLinks hideOn={navHide} />
        <DaypartControl compact className="hidden sm:flex" />
        {trailing}
        <MobileNav hideOn={navHide} />
      </nav>
    </header>
  )
}
