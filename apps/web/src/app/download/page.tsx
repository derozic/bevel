import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CloudArrowDownIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  GlobeAltIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import { BEVEL_NAME, BEVEL_HOME_PATH } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Download · ${BEVEL_NAME}`,
  description:
    'Install BEVEL: Apple Silicon Flutter app for computer integration and audio huddles, or install from the browser for a light shell.',
}

const NATIVE_PLATFORMS = [
  {
    id: 'macos',
    name: 'Mac (Apple Silicon)',
    detail:
      'Recommended — native mics/speakers, Hermes Desktop, deep links, audio huddles',
    icon: ComputerDesktopIcon,
    href: '#macos',
    badge: 'arm64 · primary',
    recommended: true,
  },
  {
    id: 'ios',
    name: 'iOS',
    detail: 'iPhone and iPad · TestFlight / App Store',
    icon: DevicePhoneMobileIcon,
    href: '#ios',
    badge: 'Flutter',
    recommended: false,
  },
  {
    id: 'android',
    name: 'Android',
    detail: 'Phone and tablet · Play Store / APK',
    icon: DeviceTabletIcon,
    href: '#android',
    badge: 'Flutter',
    recommended: false,
  },
] as const

export default function DownloadPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-8 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Install
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Get {BEVEL_NAME} on your computer
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Two install paths. For Mac work — Hermes, system audio, and{' '}
          <strong className="font-medium text-foreground">audio huddles</strong>{' '}
          — use the full Silicon Flutter app. Browser install stays available as
          a light shell for notifications and quick access.
        </p>
      </div>

      {/* Dual track */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section
          id="macos"
          className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-5"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ComputerDesktopIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Recommended · computer integration
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Apple Silicon app
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Full Flutter desktop client. Device discovery (CoreAudio +
              AVFoundation) for mics and speakers — required before audio
              huddles feel as reliable as Slack. Hermes Desktop handoffs, native
              notifications, and production login at bevel.is.
            </p>
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted">
            <li className="flex gap-2">
              <SpeakerWaveIcon className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Host mic / speaker / camera inventory for huddles
            </li>
            <li className="flex gap-2">
              <CpuChipIcon className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Hermes Desktop + fleet agent interop
            </li>
            <li className="flex gap-2">
              <CloudArrowDownIcon className="mt-0.5 size-3.5 shrink-0 text-accent" />
              arm64 + x86_64 universal build
            </li>
          </ul>
          <p className="mt-auto text-xs text-muted">
            Local release:{' '}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              BEVEL_ENV=production ./scripts/mobile/release.sh macos
            </code>
            <br />
            Artifact:{' '}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">
              dist/native/&lt;ver&gt;/BEVEL-macos-arm64.app
            </code>
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-5">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted">
            <GlobeAltIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Light · browser install
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Install as app (PWA)
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Add BEVEL from Safari / Chrome (“Install app” / Add to Dock). Good
              for web notifications and a dock icon. Not enough for reliable
              device discovery or computer-integrated huddles.
            </p>
          </div>
          <p className="mt-auto text-xs leading-relaxed text-muted">
            Open{' '}
            <Link href={BEVEL_HOME_PATH} className="font-medium text-accent hover:underline">
              the workspace
            </Link>
            , then use the browser install prompt. Service worker + web
            manifest already ship with the site.
          </p>
        </section>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {NATIVE_PLATFORMS.map((p) => {
          const Icon = p.icon
          return (
            <li key={p.id}>
              <a
                id={p.id === 'macos' ? undefined : p.id}
                href={p.href}
                className={`flex h-full flex-col gap-3 rounded-2xl border p-4 transition hover:border-accent/40 hover:bg-surface ${
                  p.recommended
                    ? 'border-accent/30 bg-surface/80'
                    : 'border-border bg-surface/60'
                }`}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {p.detail}
                  </p>
                </div>
                <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  <CpuChipIcon className="size-3" aria-hidden />
                  {p.badge}
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <section className="rounded-2xl border border-border bg-background/50 p-5 text-sm text-muted">
        <div className="flex items-start gap-3">
          <CloudArrowDownIcon className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">Why Silicon for huddles</p>
            <p className="leading-relaxed">
              Audio huddles need a stable inventory of host mics and speakers
              before join. The native app enumerates CoreAudio + AVFoundation
              devices with sandbox entitlements. Browser / PWA{' '}
              <code className="rounded bg-surface px-1 text-[11px]">
                enumerateDevices
              </code>{' '}
              often returns empty labels, ephemeral permission, and no clean
              handoff into CallKit-style ringing. Prefer Silicon on Mac; keep
              PWA for lightweight access.
            </p>
            <ul className="list-disc space-y-1 pl-4 leading-relaxed">
              <li>
                <strong className="text-foreground">Mac Silicon</strong> —
                production build targets bevel.is / bevel.2x4m.cc / api.bevel.is
              </li>
              <li>
                <strong className="text-foreground">iOS / Android</strong> —
                same Flutter tree; store / TestFlight when org distribution is
                on
              </li>
              <li>
                <strong className="text-foreground">Browser install</strong> —
                notifications + standalone window only
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={BEVEL_HOME_PATH}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Back to workspace
        </Link>
        <Link
          href="/settings?section=media"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          Audio & video prefs
        </Link>
        <Link
          href="/console"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          Console
        </Link>
      </div>
    </main>
  )
}
