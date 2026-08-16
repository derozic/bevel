import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  isPlatformEntryTenantSlug,
  platformEntryTenant,
} from '@bevel/tenant-config'
import { BevelCutMark } from '@/components/BevelCutMark'
import { BevelMark } from '@/components/BevelMark'

/**
 * Login shell:
 * - bevel.is (platform entry) → BEVEL cut-mark + wordmark only (never customer brands)
 * - org hosts (e.g. bevel.2x4m.cc) → that tenant's name/logo after host resolve
 *
 * Customer logos only appear on *their* host, not on the platform login.
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

  // Org hosts only — never use tenant logoUrl on platform entry
  const tenantLogo =
    !isPlatform && tenant?.theme.logoUrl ? tenant.theme.logoUrl : null

  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="relative z-50 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-foreground transition hover:opacity-90"
          >
            {isPlatform ? (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground">
                  <BevelCutMark className="text-foreground" />
                </span>
                <BevelMark size="md" className="text-foreground" />
              </>
            ) : (
              <>
                {tenantLogo ? (
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                    <Image
                      src={tenantLogo}
                      alt=""
                      width={36}
                      height={36}
                      className="size-7 object-contain"
                      priority
                    />
                  </span>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground">
                    <BevelCutMark className="text-foreground" />
                  </span>
                )}
                <span className="font-display text-sm font-semibold tracking-tight text-foreground">
                  {productName}
                </span>
              </>
            )}
            {isPlatform ? (
              <span className="hidden text-sm text-muted sm:inline">
                channels for humans and agents
              </span>
            ) : null}
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-muted">
            {isPlatform ? (
              <>
                <Link href="/about" className="transition hover:text-foreground">
                  About
                </Link>
                <Link
                  href="/download"
                  className="hidden transition hover:text-foreground sm:inline"
                >
                  Download
                </Link>
                <Link href="/claim" className="transition hover:text-foreground">
                  Claim
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="transition hover:text-foreground">
                  Workspace
                </Link>
                <Link href="/login" className="transition hover:text-foreground">
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        {isPlatform ? (
          <>
            <span>© {year} BEVEL</span>
            <span className="mx-2">·</span>
            <Link href="/" className="font-medium hover:text-foreground">
              Home
            </Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="font-medium hover:text-foreground">
              Privacy
            </Link>
          </>
        ) : (
          <>
            <span>
              © {year} {productName}
            </span>
            <span className="mx-2">·</span>
            <Link href="/" className="font-medium hover:text-foreground">
              Workspace
            </Link>
            <span className="mx-2">·</span>
            <Link
              href="https://bevel.is"
              className="font-medium hover:text-foreground"
            >
              Powered by BEVEL
            </Link>
          </>
        )}
      </footer>
    </div>
  )
}
