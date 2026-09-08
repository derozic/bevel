'use client'

import { useEffect, useState } from 'react'
import { RealtimeLiveDialog } from './RealtimeLiveDialog'

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

const LIVE_TARGET_BY_ID: Record<string, string> = {
  realtime: 'realtime',
}

export function StatusDashboard({ probes: initial, checkedAt }: Props) {
  const [probes, setProbes] = useState(initial)
  const [at, setAt] = useState(checkedAt)
  const [refreshing, setRefreshing] = useState(false)
  const [liveId, setLiveId] = useState<string | null>(null)

  useEffect(() => {
    setProbes(initial)
    setAt(checkedAt)
  }, [initial, checkedAt])

  // Soft refresh every 45s — pause while a human is watching a live graph.
  useEffect(() => {
    if (liveId) return
    const id = window.setInterval(() => {
      setRefreshing(true)
      window.location.reload()
    }, 45_000)
    return () => window.clearInterval(id)
  }, [liveId])

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
        {probes.map((p) => {
          const liveTarget = LIVE_TARGET_BY_ID[p.id]
          const expanded = liveId === p.id
          return (
            <li
              key={p.id}
              className={p.ok ? 'status-row status-row--ok' : 'status-row status-row--bad'}
            >
              {liveTarget ? (
                <button
                  type="button"
                  className="status-row-hit"
                  aria-expanded={expanded}
                  aria-controls={`status-live-${p.id}`}
                  onClick={() => setLiveId(expanded ? null : p.id)}
                >
                  <StatusRowBody
                    probe={p}
                    hint={expanded ? 'Live telemetry running' : 'Click to watch live'}
                  />
                </button>
              ) : (
                <div className="status-row-hit status-row-hit--static">
                  <StatusRowBody probe={p} />
                </div>
              )}
              {expanded && liveTarget ? (
                <RealtimeLiveDialog
                  id={`status-live-${p.id}`}
                  target={liveTarget}
                  publicUrl={p.url}
                  initialLatencyMs={p.latencyMs}
                  onClose={() => setLiveId(null)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="status-refresh">
        {liveId
          ? 'Live telemetry running — page refresh paused.'
          : refreshing
            ? 'Refreshing…'
            : 'Auto-refreshes every 45 seconds. Click Realtime for a live occupancy popup.'}{' '}
        Snapshot {new Date(at).toISOString()}
      </p>
    </section>
  )
}

function StatusRowBody({
  probe,
  hint,
}: {
  probe: StatusProbe
  hint?: string
}) {
  return (
    <>
      <div className="status-row-main">
        <span className="status-dot" aria-hidden />
        <div>
          <p className="status-row-name">{probe.name}</p>
          <p className="status-row-url">{probe.url.replace(/^https?:\/\//, '')}</p>
          {hint ? <p className="status-row-hint">{hint}</p> : null}
        </div>
      </div>
      <div className="status-row-meta">
        <span className="status-latency">{probe.latencyMs} ms</span>
        <span className="status-code">
          {probe.status > 0 ? probe.status : '—'}
          {probe.detail ? ` · ${probe.detail}` : ''}
        </span>
      </div>
    </>
  )
}
