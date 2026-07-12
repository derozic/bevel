import Link from 'next/link'

const ENV_KEYS = [
  {
    name: 'AUTH_SECRET',
    purpose: 'Session + realtime JWT signing',
  },
  {
    name: 'AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET',
    purpose: 'Google Workspace OIDC',
  },
  {
    name: 'AUTH_COOKIE_DOMAIN',
    purpose: 'Shared cookie domain for org hops (.lvh.me)',
  },
  {
    name: 'AUTH_URL / NEXTAUTH_URL',
    purpose: 'OAuth callback base (platform host)',
  },
  {
    name: 'REALTIME_URL / NEXT_PUBLIC_REALTIME_URL',
    purpose: 'Browser Colyseus endpoint',
  },
  {
    name: 'REALTIME_SERVER_URL',
    purpose: 'Server-side realtime (HTTP, no Caddy TLS)',
  },
  {
    name: 'BEVEL_TENANTS_ROOT',
    purpose: 'Path to tenants/*/bevel.yaml',
  },
  {
    name: 'API_PORT / BEVEL_API_URL',
    purpose: 'Control plane REST + GraphQL',
  },
] as const

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Operator settings</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Platform configuration for BEVEL™. Member preferences live in the
          product workspace (Preferences), not here.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Member vs operator
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--bevel-text-muted)]">
          <li>
            <strong className="text-[var(--bevel-text)]">Members</strong> open
            Preferences in the workspace (rail → Preferences, or{' '}
            <kbd className="rounded border border-[var(--bevel-border)] px-1 font-mono text-xs">
              ⌘,
            </kbd>
            ) for account, notifications, camera/mic, and more.
          </li>
          <li>
            <strong className="text-[var(--bevel-text)]">Operators</strong> use
            this console for tenants, domains, announcements, realtime health,
            and env-driven platform defaults.
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Environment inventory
        </h2>
        <p className="text-sm text-[var(--bevel-text-muted)]">
          Secrets live in the monorepo <code className="font-mono text-xs">.env</code>{' '}
          (never commit values). See <code className="font-mono text-xs">.env.example</code>.
        </p>
        <div className="overflow-hidden rounded-lg border border-[var(--bevel-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-[var(--bevel-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Variable</th>
                <th className="px-3 py-2 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {ENV_KEYS.map((row) => (
                <tr
                  key={row.name}
                  className="border-t border-[var(--bevel-border)]"
                >
                  <td className="px-3 py-2 font-mono text-xs text-[var(--bevel-text)]">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-[var(--bevel-text-muted)]">
                    {row.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Declarative tenants
        </h2>
        <p className="text-sm text-[var(--bevel-text-muted)]">
          Features, auth domains, and branding are declared in{' '}
          <code className="font-mono text-xs">tenants/*/bevel.yaml</code>. Edit
          files and validate with the CLI — no SQLite admin UI.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/dashboard/tenants"
            className="rounded-lg border border-[var(--bevel-border)] px-3 py-1.5 text-[var(--bevel-text)] hover:bg-white/5"
          >
            View tenants
          </Link>
          <Link
            href="/dashboard/domains"
            className="rounded-lg border border-[var(--bevel-border)] px-3 py-1.5 text-[var(--bevel-text)] hover:bg-white/5"
          >
            Domains
          </Link>
          <Link
            href="/dashboard/realtime"
            className="rounded-lg border border-[var(--bevel-border)] px-3 py-1.5 text-[var(--bevel-text)] hover:bg-white/5"
          >
            Realtime
          </Link>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-[var(--bevel-text-muted)]">
          {`pnpm bevel list
pnpm bevel doctor demo --offline
pnpm bevel validate 2x4m`}
        </pre>
      </section>
    </div>
  )
}