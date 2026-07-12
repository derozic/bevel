import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CloudArrowDownIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
} from '@heroicons/react/24/outline'
import { BEVEL_NAME, BEVEL_HOME_PATH } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Download · ${BEVEL_NAME}`,
  description:
    'Install the BEVEL Flutter app on iOS, Android, or Apple Silicon Mac.',
}

const PLATFORMS = [
  {
    id: 'ios',
    name: 'iOS',
    detail: 'iPhone and iPad · App Store / TestFlight',
    icon: DevicePhoneMobileIcon,
    href: '#ios',
    badge: 'Flutter',
  },
  {
    id: 'android',
    name: 'Android',
    detail: 'Phone and tablet · Play Store / APK',
    icon: DeviceTabletIcon,
    href: '#android',
    badge: 'Flutter',
  },
  {
    id: 'macos',
    name: 'Mac (Apple Silicon)',
    detail: 'M1 / M2 / M3 / M4 · native Flutter desktop',
    icon: ComputerDesktopIcon,
    href: '#macos',
    badge: 'arm64',
  },
] as const

export default function DownloadPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-8 px-6 py-14">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Mobile & desktop
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Get the {BEVEL_NAME} Flutter app
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Stay connected on the go. One Flutter codebase ships to iOS, Android,
          and Apple Silicon Mac — same channels, agents, and workspace identity.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => {
          const Icon = p.icon
          return (
            <li key={p.id}>
              <a
                id={p.id}
                href={p.href}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4 transition hover:border-accent/40 hover:bg-surface"
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
            <p className="font-medium text-foreground">Install notes</p>
            <ul className="list-disc space-y-1 pl-4 leading-relaxed">
              <li>
                <strong className="text-foreground">iOS</strong> — install from
                TestFlight or the App Store when your org enables distribution.
              </li>
              <li>
                <strong className="text-foreground">Android</strong> — Play
                Store listing or signed APK from your workspace admin.
              </li>
              <li>
                <strong className="text-foreground">Mac Silicon</strong> —
                download the arm64 Flutter desktop build; Intel Macs are not
                supported for this build.
              </li>
            </ul>
            <p className="text-xs">
              Store links and build artifacts will attach here as release
              pipelines land. For now, open the workspace on the web and ask an
              operator for the latest Flutter package.
            </p>
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
      </div>
    </main>
  )
}
