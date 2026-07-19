import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { StatusDashboard, type StatusProbe } from './StatusDashboard'

export const metadata: Metadata = {
  title: 'BEVEL status',
  description: 'Live uptime and reliability for BEVEL workspace services.',
  robots: { index: true, follow: true },
}

export const dynamic = 'force-dynamic'

async function probe(
  name: string,
  url: string,
  okWhen: (status: number, body: string) => boolean,
): Promise<StatusProbe> {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json, text/html' },
    })
    const body = await res.text()
    const latencyMs = Date.now() - started
    const ok = okWhen(res.status, body)
    let detail: string | undefined
    try {
      const j = JSON.parse(body) as { version?: string; ok?: boolean }
      if (j.version) detail = `v${j.version}`
    } catch {
      /* non-json */
    }
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      url,
      ok,
      status: res.status,
      latencyMs,
      detail,
    }
  } catch (err) {
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : 'unreachable',
    }
  }
}

export default async function StatusPage() {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'bevel.is'
  const proto = h.get('x-forwarded-proto') || 'https'
  const origin = `${proto}://${host}`

  // Also probe platform siblings when we share the EC2 edge.
  const probes = await Promise.all([
    probe('BEVEL web', `${origin}/api/health`, (s, b) => s === 200 && b.includes('bevel')),
    probe('BEVEL home', `${origin}/`, (s) => s >= 200 && s < 400),
    probe('2x4m API', 'https://api.2x4m.cc/health', (s, b) => s === 200 && b.includes('healthy')),
    probe('2x4m market', 'https://market.2x4m.cc/', (s) => s >= 200 && s < 400),
  ])

  const allOk = probes.every((p) => p.ok)
  const checkedAt = new Date().toISOString()

  return (
    <main className="status-page">
      <div className="status-shell">
        <header className="status-header">
          <Link href="/" className="status-mark">
            BEVEL
          </Link>
          <p className="status-kicker">Service status</p>
        </header>

        <section
          className={`status-hero ${allOk ? 'status-hero--ok' : 'status-hero--degraded'}`}
          aria-live="polite"
        >
          <h1>{allOk ? 'All systems operational' : 'Degraded performance'}</h1>
          <p>
            {allOk
              ? 'Workspace channels, auth, and platform APIs are responding normally.'
              : 'One or more checks failed. We are investigating — core routes may still work.'}
          </p>
          <p className="status-checked">
            Last checked{' '}
            <time dateTime={checkedAt}>
              {new Date(checkedAt).toLocaleString('en-US', {
                timeZone: 'UTC',
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}{' '}
              UTC
            </time>
          </p>
        </section>

        <StatusDashboard probes={probes} checkedAt={checkedAt} />

        <footer className="status-footer">
          <p>
            Hosted on a single EC2 edge with PostgreSQL for platform data.
            BEVEL workspaces use file-backed tenant config (no SQLite).
          </p>
          <p>
            <Link href="/">Back to BEVEL</Link>
            {' · '}
            <a href="https://api.2x4m.cc/health">Platform API health</a>
          </p>
        </footer>
      </div>
    </main>
  )
}
