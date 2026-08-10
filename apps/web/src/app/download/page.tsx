import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowDownTrayIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  GlobeAltIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { BEVEL_NAME, BEVEL_HOME_PATH } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Download · ${BEVEL_NAME}`,
  description:
    'Install the BEVEL Flutter app on iPhone, Android, or Mac — or use the browser workspace.',
}

/** Absolute HTTPS URL for OTA manifest (Safari requires full URL). */
const IOS_OTA_HREF =
  'itms-services://?action=download-manifest&url=https%3A%2F%2Fbevel.is%2Fdownloads%2Fmanifest.plist'

const DOWNLOADS = {
  iosIpa: '/downloads/BEVEL.ipa',
  iosManifest: '/downloads/manifest.plist',
  androidApk: '/downloads/BEVEL-android.apk',
  macosZip: '/downloads/BEVEL-macos-arm64.zip',
} as const

export default function DownloadPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-8 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Install
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Download {BEVEL_NAME}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Native Flutter clients for iPhone, Android, and Mac. Prefer the native
          app for Google Workspace sign-in and chat; the browser stays available
          as a light shell.
        </p>
      </div>

      {/* iOS — primary request */}
      <section
        id="ios"
        className="scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-accent/40 bg-accent/5 p-6"
      >
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
              Install the Flutter client (v0.4.3). Open this page in{' '}
              <strong className="font-medium text-foreground">Safari on your iPhone</strong>{' '}
              and tap install. Registered development devices only until TestFlight
              is live.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={IOS_OTA_HREF}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <ArrowDownTrayIcon className="size-4" aria-hidden />
            Install on this iPhone
          </a>
          <a
            href={DOWNLOADS.iosIpa}
            download="BEVEL.ipa"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface"
          >
            Download IPA
          </a>
          <Link
            href={BEVEL_HOME_PATH}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
          >
            Use web app instead
          </Link>
        </div>

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
              If install fails, unlock the phone and use USB from a Mac:{' '}
              <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
                ./scripts/mobile/deploy-devices.sh ios
              </code>
            </li>
          </ol>
        </div>
      </section>

      {/* Android + Mac */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section
          id="android"
          className="scroll-mt-24 flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-5"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <DeviceTabletIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Android</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Phone, Pixel Tablet, Galaxy Z Fold. Sideload APK (Play track later).
            </p>
          </div>
          <a
            href={DOWNLOADS.androidApk}
            download="BEVEL-android.apk"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <ArrowDownTrayIcon className="size-4" aria-hidden />
            Download APK
          </a>
        </section>

        <section
          id="macos"
          className="scroll-mt-24 flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-5"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ComputerDesktopIcon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Mac (Apple Silicon)
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Full desktop client — Hermes, mics/speakers, audio huddles.
            </p>
          </div>
          <a
            href={DOWNLOADS.macosZip}
            download="BEVEL-macos-arm64.zip"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <ArrowDownTrayIcon className="size-4" aria-hidden />
            Download zip
          </a>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-5">
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
              href={BEVEL_HOME_PATH}
              className="mt-3 inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        Artifacts: IPA / APK / macOS zip under{' '}
        <code className="rounded bg-surface px-1 py-0.5">/downloads/</code>.
        iOS OTA uses{' '}
        <code className="rounded bg-surface px-1 py-0.5">manifest.plist</code>.
        Rebuild: <code className="rounded bg-surface px-1 py-0.5">./scripts/mobile/release.sh</code>
        {' · '}
        <Link href="/console" className="text-accent hover:underline">
          Console
        </Link>
      </p>
    </main>
  )
}
