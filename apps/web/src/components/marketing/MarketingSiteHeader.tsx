import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@bevel/ui'
import { BevelCutMark } from '@/components/BevelCutMark'
import { BevelMark } from '@/components/BevelMark'
import { BEVEL_HOME_PATH } from '@/lib/bevel'
import { MARKETING_NAV } from '@/lib/marketing'

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
}

function BrandLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 text-foreground transition hover:opacity-90"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
        <BevelCutMark />
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
}: {
  signedIn?: boolean
  userLabel?: string | null
  primaryHref?: string
  primaryLabel?: string
}) {
  if (signedIn) {
    return (
      <>
        {userLabel ? (
          <span className="hidden max-w-[10rem] truncate text-sm text-muted sm:inline">
            {userLabel}
          </span>
        ) : null}
        <Button asChild size="md">
          <Link href={BEVEL_HOME_PATH}>Open workspace</Link>
        </Button>
      </>
    )
  }
  return (
    <>
      <Button asChild variant="outline" size="md">
        <Link href="/login?callbackUrl=%2Fwelcome">Sign in</Link>
      </Button>
      <Button asChild size="md">
        <Link href={primaryHref}>{primaryLabel}</Link>
      </Button>
    </>
  )
}

function ClaimActions({
  signedIn,
  userLabel,
}: {
  signedIn?: boolean
  userLabel?: string | null
}) {
  if (signedIn) {
    return (
      <>
        {userLabel ? (
          <span className="hidden max-w-[12rem] truncate text-sm text-muted sm:inline">
            {userLabel}
          </span>
        ) : null}
        <Button asChild size="md">
          <Link href={BEVEL_HOME_PATH}>Open workspace</Link>
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

function MarketingActions() {
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href="/login?callbackUrl=%2Fwelcome">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/claim">Claim workspace</Link>
      </Button>
    </>
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
      />
    )
  } else if (actions === 'claim') {
    trailing = <ClaimActions signedIn={signedIn} userLabel={userLabel} />
  } else {
    trailing = <MarketingActions />
  }

  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
      <BrandLink />
      <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
        <MarketingNavLinks hideOn={navHide} />
        {trailing}
      </nav>
    </header>
  )
}
