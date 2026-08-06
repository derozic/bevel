'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Signal,
  Wifi,
} from 'lucide-react'
import { bevelUrls } from '@/components/console/bevel-urls'

type Probe = {
  name: string
  url: string
  ok: boolean
  latencyMs: number
  detail?: string
}

export default function ConsoleStatusPage() {
  const [probes, setProbes] = useState<Probe[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState('—')

  const run = useCallback(async () => {
    setIsRefreshing(true)
    // Same-origin first so console on bevel.2x4m.cc never depends on CORS for
    // the primary "is this web process up?" check. Cross-host probes still run
    // when CORS is enabled on /api/health.
    const thisOrigin =
      typeof window !== 'undefined' ? window.location.origin : bevelUrls.web()
    const workspaceOrigin = 'https://bevel.2x4m.cc'
    const platformOrigin = bevelUrls.platformWeb()

    const targets: { name: string; url: string; ok: (s: number, b: string) => boolean }[] = [
      {
        name: 'Workspace web',
        url: `${thisOrigin}/api/health`,
        ok: (s, b) => s === 200 && b.includes('bevel-web'),
      },
    ]

    // When viewing console on a non-workspace host (e.g. bevel.is), also probe
    // the production workspace origin explicitly.
    if (thisOrigin.replace(/\/$/, '') !== workspaceOrigin) {
      targets.push({
        name: 'Workspace host (2x4m)',
        url: `${workspaceOrigin}/api/health`,
        ok: (s, b) => s === 200 && b.includes('bevel-web'),
      })
    }

    // When on workspace, also probe platform apex (optional multi-host view).
    if (
      thisOrigin.replace(/\/$/, '') !== platformOrigin.replace(/\/$/, '') &&
      platformOrigin.includes('bevel.is')
    ) {
      targets.push({
        name: 'Platform web (bevel.is)',
        url: `${platformOrigin.replace(/\/$/, '')}/api/health`,
        ok: (s, b) => s === 200 && b.includes('bevel-web'),
      })
    }

    targets.push(
      {
        name: 'Control plane API',
        url: `${bevelUrls.api()}/health`,
        ok: (s, b) => s === 200 && b.includes('"status":"ok"'),
      },
      {
        name: 'Realtime',
        url: `${bevelUrls.realtime()}/health`,
        ok: (s, b) => s === 200 && b.includes('ok'),
      },
      {
        name: 'Matrix fabric status',
        url: `${bevelUrls.api()}/api/v1/matrix/status`,
        ok: (s, b) => s === 200 && b.includes('phases'),
      },
      {
        name: 'API docs (OpenAPI UI)',
        url: bevelUrls.docs(),
        ok: (s) => s === 200,
      },
    )

    const next: Probe[] = []
    for (const t of targets) {
      const started = Date.now()
      try {
        const res = await fetch(t.url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        })
        const body = await res.text()
        let detail: string | undefined
        try {
          const j = JSON.parse(body) as {
            version?: string
            database?: { status?: string; counts?: Record<string, number> }
            realtime?: string
            degraded?: boolean
          }
          const bits: string[] = []
          if (j.version) bits.push(`v${j.version}`)
          if (j.database?.status) bits.push(`db:${j.database.status}`)
          if (j.realtime) bits.push(`rt:${j.realtime}`)
          if (j.database?.counts) {
            bits.push(
              `tenants ${j.database.counts.tenants ?? 0} · msgs ${j.database.counts.messages ?? 0}`,
            )
          }
          if (j.degraded) bits.push('degraded')
          detail = bits.join(' · ') || undefined
        } catch {
          detail = undefined
        }
        next.push({
          name: t.name,
          url: t.url,
          ok: t.ok(res.status, body),
          latencyMs: Date.now() - started,
          detail,
        })
      } catch (err) {
        next.push({
          name: t.name,
          url: t.url,
          ok: false,
          latencyMs: Date.now() - started,
          detail: err instanceof Error ? err.message : 'unreachable',
        })
      }
    }
    setProbes(next)
    setLastFetch(new Date().toLocaleTimeString())
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    void run()
    const id = window.setInterval(() => void run(), 15000)
    return () => window.clearInterval(id)
  }, [run])

  const allOk = probes.length > 0 && probes.every((p) => p.ok)

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <Activity className="h-8 w-8 text-accent" />
            Status
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Live probes for bevel.2x4m.cc, FastAPI + PostgreSQL, and realtime. Auto-refreshes every 15s.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-raised"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div
        className={`rounded-2xl border px-5 py-4 ${
          allOk
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-warning/30 bg-warning/10 text-warning'
        }`}
      >
        <p className="text-lg font-semibold">
          {allOk ? 'All systems operational' : 'Degraded — one or more checks failing'}
        </p>
        <p className="mt-1 text-xs opacity-80">Last checked {lastFetch}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {probes.map((p) => (
          <li
            key={p.name}
            className={`rounded-2xl border p-4 ${
              p.ok ? 'border-border bg-surface' : 'border-danger/40 bg-danger/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {p.name.includes('API') ? (
                  <Server className="h-5 w-5 text-accent" />
                ) : p.name.includes('Realtime') ? (
                  <Wifi className="h-5 w-5 text-accent" />
                ) : p.name.includes('docs') ? (
                  <HardDrive className="h-5 w-5 text-accent" />
                ) : (
                  <Database className="h-5 w-5 text-accent" />
                )}
                <div>
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <p className="truncate text-[11px] text-muted">{p.url.replace(/^https?:\/\//, '')}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  p.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                }`}
              >
                {p.ok ? 'up' : 'down'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Signal className="h-3.5 w-3.5" />
                {p.latencyMs} ms
              </span>
              <span className="truncate pl-2 text-right">{p.detail || '—'}</span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        Public dashboard:{' '}
        <a className="font-semibold text-accent underline-offset-2 hover:underline" href="https://status.bevel.is/">
          status.bevel.is
        </a>
      </p>
    </div>
  )
}
