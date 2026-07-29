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
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="relative z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-gray-900 transition hover:opacity-90"
          >
            {isPlatform ? (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-900">
                  <BevelCutMark className="text-gray-900" />
                </span>
                <BevelMark size="md" className="text-gray-900" />
              </>
            ) : (
              <>
                {tenantLogo ? (
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
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
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-900">
                    <BevelCutMark className="text-gray-900" />
                  </span>
                )}
                <span className="font-display text-sm font-semibold tracking-tight text-gray-900">
                  {productName}
                </span>
              </>
            )}
            {isPlatform ? (
              <span className="hidden text-sm text-gray-500 sm:inline">
                channels for humans and agents
              </span>
            ) : null}
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-gray-600">
            {isPlatform ? (
              <>
                <Link href="/about" className="transition hover:text-gray-900">
                  About
                </Link>
                <Link
                  href="/download"
                  className="hidden transition hover:text-gray-900 sm:inline"
                >
                  Download
                </Link>
                <Link href="/claim" className="transition hover:text-gray-900">
                  Claim
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="transition hover:text-gray-900">
                  Workspace
                </Link>
                <Link href="/login" className="transition hover:text-gray-900">
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

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-500">
        {isPlatform ? (
          <>
            <span>© {year} BEVEL</span>
            <span className="mx-2">·</span>
            <Link href="/" className="font-medium hover:text-gray-800">
              Home
            </Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="font-medium hover:text-gray-800">
              Privacy
            </Link>
          </>
        ) : (
          <>
            <span>
              © {year} {productName}
            </span>
            <span className="mx-2">·</span>
            <Link href="/" className="font-medium hover:text-gray-800">
              Workspace
            </Link>
            <span className="mx-2">·</span>
            <Link
              href="https://bevel.is"
              className="font-medium hover:text-gray-800"
            >
              Powered by BEVEL
            </Link>
          </>
        )}
      </footer>
    </div>
  )
}
