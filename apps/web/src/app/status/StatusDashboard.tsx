'use client'

import { useEffect, useState } from 'react'

export type StatusProbe = {
  id: string
  name: string
  url: string
  ok: boolean
  status: number
  latencyMs: number
  detail?: string
}

type Props = {
  probes: StatusProbe[]
  checkedAt: string
}

export function StatusDashboard({ probes: initial, checkedAt }: Props) {
  const [probes, setProbes] = useState(initial)
  const [at, setAt] = useState(checkedAt)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setProbes(initial)
    setAt(checkedAt)
  }, [initial, checkedAt])

  // Soft refresh every 45s so humans see live latency without a hard reload.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshing(true)
      window.location.reload()
    }, 45_000)
    return () => window.clearInterval(id)
  }, [])

  const overall = probes.every((p) => p.ok)

  return (
    <section className="status-board" aria-label="Service checks">
      <div className="status-board-head">
        <h2>Checks</h2>
        <span className={overall ? 'status-pill status-pill--ok' : 'status-pill status-pill--bad'}>
          {overall ? 'Healthy' : 'Attention'}
        </span>
      </div>
      <ul className="status-list">
        {probes.map((p) => (
          <li key={p.id} className={p.ok ? 'status-row status-row--ok' : 'status-row status-row--bad'}>
            <div className="status-row-main">
              <span className="status-dot" aria-hidden />
              <div>
                <p className="status-row-name">{p.name}</p>
                <p className="status-row-url">{p.url.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>
            <div className="status-row-meta">
              <span className="status-latency">{p.latencyMs} ms</span>
              <span className="status-code">
                {p.status > 0 ? p.status : '—'}
                {p.detail ? ` · ${p.detail}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="status-refresh">
        {refreshing ? 'Refreshing…' : 'Auto-refreshes every 45 seconds.'} Snapshot{' '}
        {new Date(at).toISOString()}
      </p>
    </section>
  )
}
