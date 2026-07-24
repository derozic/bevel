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
      const j = JSON.parse(body) as {
        version?: string
        ok?: boolean
        status?: string
        database?: { status?: string }
        realtime?: string
        degraded?: boolean
      }
      if (j.version) detail = `v${j.version}`
      if (j.database?.status) {
        detail = [detail, `db:${j.database.status}`].filter(Boolean).join(' · ')
      }
      if (typeof j.realtime === 'string') {
        detail = [detail, `rt:${j.realtime}`].filter(Boolean).join(' · ')
      }
      if (j.degraded) detail = [detail, 'degraded'].filter(Boolean).join(' · ')
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

  const apiBase = (
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    process.env.BEVEL_API_URL ||
    'https://api.bevel.is'
  ).replace(/\/$/, '')
  const realtimeBase = (
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.REALTIME_URL ||
    'https://realtime.bevel.is'
  ).replace(/\/$/, '')

  // Core product surfaces for bevel.2x4m.cc / bevel.is reliability.
  const probes = await Promise.all([
    probe(
      'Workspace web',
      'https://bevel.2x4m.cc/api/health',
      (s, b) => s === 200 && b.includes('bevel-web'),
    ),
    probe(
      'Workspace home',
      'https://bevel.2x4m.cc/',
      (s) => s >= 200 && s < 400,
    ),
    probe(
      'Workspace login',
      'https://bevel.2x4m.cc/login',
      (s) => s >= 200 && s < 400,
    ),
    probe(
      'Platform entry',
      'https://bevel.is/login',
      (s) => s >= 200 && s < 400,
    ),
    probe(
      'Control plane API',
      `${apiBase}/health`,
      (s, b) =>
        s === 200 &&
        b.includes('"status":"ok"') &&
        b.includes('"database"') &&
        b.includes('"status":"ok"'),
    ),
    probe(
      'Realtime',
      `${realtimeBase}/health`,
      (s, b) => s === 200 && b.includes('ok'),
    ),
    probe(
      'This host',
      `${origin}/api/health`,
      (s, b) => s === 200 && b.includes('bevel'),
    ),
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
              ? 'Workspace web, login, Postgres API, and realtime are responding normally for bevel.2x4m.cc.'
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
            Single EC2 edge: Next web, FastAPI + PostgreSQL, Colyseus realtime.
            Product data is Postgres-only (no SQLite or file JSON stores).
          </p>
          <p>
            <Link href="https://bevel.2x4m.cc/">Workspace</Link>
            {' · '}
            <a href="https://api.bevel.is/health">API health</a>
            {' · '}
            <a href="https://realtime.bevel.is/health">Realtime health</a>
          </p>
        </footer>
      </div>
    </main>
  )
}
