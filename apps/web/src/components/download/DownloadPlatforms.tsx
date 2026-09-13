'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowDownTrayIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import {
  clientHeadline,
  featuredSurface,
  otaInstallLabel,
  parseDownloadClient,
  surfaceOrder,
  type DownloadClient,
  type DownloadSurface,
} from '@/lib/download-client'
import { cn } from '@/lib/utils'

/** Absolute HTTPS URL for OTA manifest (Safari requires full URL). */
const IOS_OTA_HREF =
  'itms-services://?action=download-manifest&url=https%3A%2F%2Fbevel.is%2Fdownloads%2Fmanifest.plist'

const DOWNLOADS = {
  iosIpa: '/downloads/BEVEL.ipa',
  androidApk: '/downloads/BEVEL-android.apk',
  macosPkg: '/downloads/BEVEL-macos-arm64.pkg',
  macosDmg: '/downloads/BEVEL-macos-arm64.dmg',
  releaseManifest: '/downloads/manifest.json',
} as const

const MAC_VERSION = '1.0.0'
const MAC_BUILD = '16'

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90'
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-surface'

function Card({
  id,
  featured,
  children,
}: {
  id: string
  featured: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 flex flex-col gap-4 rounded-2xl p-6',
        featured
          ? 'border border-accent/40 bg-accent/5'
          : 'border border-border bg-surface/60',
      )}
    >
      {featured ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          This device
        </p>
      ) : null}
      {children}
    </section>
  )
}

function MacCard({ featured }: { featured: boolean }) {
  return (
    <Card id="macos" featured={featured}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent">
          <ComputerDesktopIcon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Mac · Apple Silicon
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            BEVEL for Mac
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            v{MAC_VERSION} (build {MAC_BUILD}) signed installer. Places BEVEL in
            /Applications and registers the bevel:// handler. Signed by
            Earthena, Inc. (Developer ID Installer · 8A36CUVEDS). Apple Silicon,
            macOS 11 or later.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href={DOWNLOADS.macosPkg} className={featured ? primaryBtn : secondaryBtn}>
          <ArrowDownTrayIcon className="size-4" aria-hidden />
          Install for Mac
        </a>
        <a href={DOWNLOADS.macosDmg} className={secondaryBtn}>
          Disk image
        </a>
        <a href={DOWNLOADS.releaseManifest} className={secondaryBtn}>
          Full manifest
        </a>
        <a
          href="https://github.com/derozic/bevel/releases/latest"
          className={secondaryBtn}
        >
          GitHub Releases
        </a>
      </div>
      {featured ? (
        <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-xs leading-relaxed text-muted">
          <p className="flex items-start gap-2 font-medium text-foreground">
            <InformationCircleIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            Professional install
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Download the installer. Prefer Safari if Chrome warns that the file
              is uncommon — that is reputation, not a broken signature.
            </li>
            <li>
              Open{' '}
              <code className="rounded bg-surface px-1">BEVEL-macos-arm64.pkg</code>.
              Installer copies BEVEL into{' '}
              <code className="rounded bg-surface px-1">/Applications</code> and
              registers <code className="rounded bg-surface px-1">bevel://</code>.
            </li>
            <li>
              Launch BEVEL from Applications or Spotlight. It talks to bevel.is.
            </li>
          </ol>
        </div>
      ) : null}
    </Card>
  )
}

function IosCard({
  featured,
  client,
}: {
  featured: boolean
  client: DownloadClient
}) {
  const otaLabel = otaInstallLabel(client)
  return (
    <Card id="ios" featured={featured}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent">
          <DevicePhoneMobileIcon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            iPhone · iPad
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            BEVEL for iOS
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Flutter client (v1.0.0) for iPhone and iPad — dual-pane on iPad Pro,
            on-device brief on Apple Intelligence hardware. One-tap install is
            Safari on the device. Registered development devices until TestFlight
            is live.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {otaLabel ? (
          <a href={IOS_OTA_HREF} className={primaryBtn}>
            <ArrowDownTrayIcon className="size-4" aria-hidden />
            {otaLabel}
          </a>
        ) : null}
        <a
          href={DOWNLOADS.iosIpa}
          download="BEVEL.ipa"
          className={otaLabel ? secondaryBtn : featured ? primaryBtn : secondaryBtn}
        >
          Download IPA
        </a>
        <Link
          href="/login?callbackUrl=%2Fwelcome"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
        >
          Use web app instead
        </Link>
      </div>
      {!otaLabel ? (
        <p className="text-xs leading-relaxed text-muted">
          Open this page in Safari on an iPhone to light up{' '}
          <span className="font-medium text-foreground">Install on this iPhone</span>.
        </p>
      ) : (
        <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-xs leading-relaxed text-muted">
          <p className="flex items-start gap-2 font-medium text-foreground">
            <InformationCircleIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            After install
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Settings → General → VPN &amp; Device Management → trust the
              developer certificate if prompted.
            </li>
            <li>
              Open <strong className="text-foreground">BEVEL</strong> → Continue
              with Google (Workspace account).
            </li>
            <li>
              If install fails, unlock the device, connect it by USB to a Mac,
              and ask an operator to push a registered development build.
            </li>
          </ol>
        </div>
      )}
    </Card>
  )
}

function AndroidCard({ featured }: { featured: boolean }) {
  return (
    <Card id="android" featured={featured}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent">
          <DeviceTabletIcon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Android
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            BEVEL for Android
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Phone, Pixel Tablet, Galaxy Z Fold. Sideload the APK (Play track
            later).
          </p>
        </div>
      </div>
      <a
        href={DOWNLOADS.androidApk}
        className={featured ? primaryBtn : secondaryBtn}
      >
        <ArrowDownTrayIcon className="size-4" aria-hidden />
        Download APK
      </a>
    </Card>
  )
}

function BrowserCard({ featured }: { featured: boolean }) {
  return (
    <Card id="browser" featured={featured}>
      <div className="flex items-start gap-3">
        <GlobeAltIcon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Browser (no install)
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Open the workspace in Safari or Chrome for chat without the native
            shell. Add to Home Screen for a dock icon (PWA).
          </p>
          <Link
            href="/login?callbackUrl=%2Fwelcome"
            className={cn('mt-3', featured ? primaryBtn : secondaryBtn)}
          >
            Open workspace
          </Link>
        </div>
      </div>
    </Card>
  )
}

export function DownloadPlatforms({
  initialClient,
}: {
  initialClient: DownloadClient
}) {
  const [client, setClient] = useState(initialClient)

  useEffect(() => {
    setClient(
      parseDownloadClient({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
    )
  }, [])

  const featured = featuredSurface(client)
  const order = useMemo(() => surfaceOrder(featured), [featured])
  const headline = clientHeadline(client)

  const cards: Record<DownloadSurface, ReactNode> = {
    macos: <MacCard key="macos" featured={featured === 'macos'} />,
    ios: <IosCard key="ios" featured={featured === 'ios'} client={client} />,
    android: <AndroidCard key="android" featured={featured === 'android'} />,
    browser: <BrowserCard key="browser" featured={featured === 'browser'} />,
  }

  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{headline}</p>
      {order.map((surface) => cards[surface])}
    </>
  )
}
