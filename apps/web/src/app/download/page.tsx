import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { DownloadPlatforms } from '@/components/download/DownloadPlatforms'
import { auth } from '@/auth'
import { BEVEL_NAME, BEVEL_PRIVATE_PATH } from '@/lib/bevel'
import { parseDownloadClient } from '@/lib/download-client'
import { signedInProductHome } from '@/lib/marketing'

export const metadata: Metadata = {
  title: `Download · ${BEVEL_NAME}`,
  description:
    'Install the BEVEL Flutter app on iPhone, Android, or Mac — or use the browser workspace.',
}

export default async function DownloadPage() {
  const session = await auth()
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''
  const productHome = signedInProductHome(host)
  const initialClient = parseDownloadClient({
    userAgent: headerStore.get('user-agent'),
    secChUaPlatform: headerStore.get('sec-ch-ua-platform'),
    secChUaMobile: headerStore.get('sec-ch-ua-mobile'),
  })

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>
      <MarketingSiteHeader
        actions="marketing"
        signedIn={Boolean(session?.user?.email)}
        userLabel={session?.user?.name || session?.user?.email || null}
        productHref={productHome.href}
        productLabel={productHome.label}
      />
      <main className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-8 px-6 py-14">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Install
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Download {BEVEL_NAME}
          </h1>
        </div>

        <DownloadPlatforms initialClient={initialClient} />

        <p className="text-xs leading-relaxed text-muted">
          Artifacts under{' '}
          <code className="rounded bg-surface px-1 py-0.5">/downloads/</code>.
          Full release bill of materials:{' '}
          <a
            href="/downloads/manifest.json"
            className="text-accent hover:underline"
          >
            manifest.json
          </a>
          . Rebuild:{' '}
          <code className="rounded bg-surface px-1 py-0.5">
            ./scripts/mobile/release.sh macos
          </code>
          {' · '}
          <Link href="/console" className="text-accent hover:underline">
            Console
          </Link>
          {' · '}
          <Link href={BEVEL_PRIVATE_PATH} className="text-accent hover:underline">
            Private
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
