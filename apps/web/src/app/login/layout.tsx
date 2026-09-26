import type { ReactNode } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  isPlatformEntryTenantSlug,
  platformEntryTenant,
} from '@bevel/tenant-config'
import { BevelMark } from '@/components/BevelMark'
import { LoginDaypartBar } from '@/components/login/LoginDaypartBar'

/**
 * Login shell: void canvas + quiet wordmark. The card itself is the object.
 */
export default async function LoginLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]

  const platformEntry = isPlatformEntryHost(host)
  const tenant =
    (await getTenantFromRequest()) ??
    (platformEntry ? platformEntryTenant(host || 'bevel.is') : null)

  const isPlatform =
    platformEntry || isPlatformEntryTenantSlug(tenant?.slug)

  const productName = (
    tenant?.theme.productName ??
    tenant?.name ??
    (isPlatform ? 'BEVEL' : 'Workspace')
  ).replace(/\s+Agents$/i, '')

  const year = new Date().getFullYear()

  return (
    <div className="login-stage">
      <div className="login-stage__grid" aria-hidden />
      <header className="login-stage__header flex items-center justify-between gap-3 px-5 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-foreground/80 transition hover:text-foreground"
        >
          {isPlatform ? (
            <BevelMark size="md" className="text-foreground" />
          ) : (
            <span className="text-xs font-semibold tracking-[0.22em] uppercase">
              {productName}
            </span>
          )}
        </Link>
        <LoginDaypartBar />
      </header>

      <div className="login-stage__main">{children}</div>

      <footer className="login-stage__footer px-5 py-5 text-center text-[11px] text-muted">
        <span>© {year} {isPlatform ? 'BEVEL' : productName}</span>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/gdpr" className="hover:text-foreground">
          GDPR
        </Link>
        <span className="mx-2">·</span>
        <Link href="/ccpa" className="hover:text-foreground">
          CCPA
        </Link>
      </footer>
    </div>
  )
}
