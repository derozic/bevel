'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  formatClock,
  formatCount,
  formatHz,
  formatPerMinute,
  formatUptime,
  hzFor,
  latencyPoints,
  percentile,
  perMinute,
  pickRealtimePayload,
  successPct,
  toAreaPath,
  toSmoothPath,
  toVolumeRects,
  volumeMax,
  viewWindow,
  xAt,
  yMaxFor,
  type ProbeSample,
  type RealtimePayload,
} from './live-graph'

const ROOM_LABEL: Record<string, string> = {
  fleet_channel: 'Channels',
  agent_session: 'Talk',
  fleet_lobby: 'Lobby',
}

const TICK_MS = 1500
const WINDOW_MS = 60_000
const WIDTH = 720
const HEIGHT = 220
const LAT_TOP = 18
const LAT_BOTTOM = 142
const VOL_TOP = 158
const VOL_BOTTOM = 198
const LAT_H = LAT_BOTTOM - LAT_TOP
const VOL_H = VOL_BOTTOM - VOL_TOP

type LivePoint = {
  ok: boolean
  status: number
  latencyMs: number
  payload: RealtimePayload | null
}

function sampleFromProbe(
  elapsedMs: number,
  latencyMs: number,
  ok: boolean,
  payload: RealtimePayload | null,
): ProbeSample {
  return {
    elapsedMs,
    latencyMs,
    ok,
    rooms: payload?.rooms,
    clients: payload?.clients,
    documents: payload?.documents,
    processUptimeSec: payload?.processUptimeSec,
  }
}

export function LiveProbeGraph({
  target,
  initialLatencyMs,
}: {
  target: string
  initialLatencyMs?: number
}) {
  const originRef = useRef(Date.now())
  const uid = useId().replace(/:/g, '')
  const [now, setNow] = useState(() => Date.now())
  const [samples, setSamples] = useState<ProbeSample[]>(() =>
    initialLatencyMs != null
      ? [sampleFromProbe(0, initialLatencyMs, true, null)]
      : [],
  )
  const [last, setLast] = useState<LivePoint | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`/api/status/probe?target=${encodeURIComponent(target)}`, {
          cache: 'no-store',
        })
        const body = (await res.json()) as LivePoint & {
          detail?: string
          payload?: unknown
        }
        if (cancelled) return
        const elapsedMs = Date.now() - originRef.current
        const payload = pickRealtimePayload(body.payload)
        const point = sampleFromProbe(
          elapsedMs,
          Number(body.latencyMs) || 0,
          Boolean(body.ok),
          payload,
        )
        setLast({
          ok: point.ok,
          status: Number(body.status) || 0,
          latencyMs: point.latencyMs,
          payload,
        })
        setError(body.ok ? null : body.detail || 'probe failed')
        setSamples((prev) => {
          const next = [...prev, point]
          const cutoff = elapsedMs - WINDOW_MS
          return next.filter((s) => s.elapsedMs >= cutoff)
        })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'probe failed')
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), TICK_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [target])

  const elapsedMs = now - originRef.current
  const maxY = yMaxFor(samples)
  const maxV = volumeMax(samples)
  const latPts = latencyPoints(
    samples,
    WIDTH,
    LAT_H,
    maxY,
    WINDOW_MS,
    elapsedMs,
  ).map((p) => ({
    x: p.x,
    y: p.y + LAT_TOP,
  }))
  const line = toSmoothPath(latPts)
  const area = toAreaPath(latPts, LAT_BOTTOM)
  const bars = toVolumeRects(
    samples,
    WIDTH,
    VOL_H,
    maxV,
    WINDOW_MS,
    TICK_MS,
    elapsedMs,
  )
  const playX = Math.max(0, Math.min(WIDTH, xAt(elapsedMs, WIDTH, WINDOW_MS, elapsedMs)))
  const ok = last?.ok !== false
  const latencies = samples.map((s) => s.latencyMs)
  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  const liveCount = samples.filter((s) => s.elapsedMs > 0).length
  const hz = hzFor(liveCount, elapsedMs)
  const configuredHz = 1000 / TICK_MS
  const success = successPct(samples)
  const payload = last?.payload
  const occupancy = payload?.clients ?? samples[samples.length - 1]?.clients ?? 0
  const rooms = payload?.rooms ?? samples[samples.length - 1]?.rooms ?? 0
  const documents = payload?.documents ?? samples[samples.length - 1]?.documents ?? 0
  const sessions = payload?.sessions ?? 0
  const processUp = payload?.processUptimeSec ?? 0
  const mix = payload?.mix ?? []
  const mixMax = Math.max(1, ...mix.map((m) => Math.max(m.clients, m.rooms)))
  const clientRate = perMinute(samples, 'clients')
  const messageRate = perMinute(samples, 'documents')
  const tape = samples.filter((s) => s.elapsedMs > 0 || s.documents != null).slice(-8).reverse()
  const ticks = useMemo(() => {
    const { start, span } = viewWindow(elapsedMs, WINDOW_MS)
    return [0, 1, 2, 3, 4].map((i) => {
      const ms = start + (span * i) / 4
      const sec = ms / 1000
      const label =
        span < 10_000 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`
      return {
        s: sec,
        x: (i / 4) * WIDTH,
        label,
      }
    })
  }, [elapsedMs])

  return (
    <div className={ok ? 'status-scope' : 'status-scope status-scope--bad'} aria-live="polite">
      <div className="status-scope-hud">
        <div className="status-scope-pulse-wrap">
          <span className={ok ? 'status-scope-pulse' : 'status-scope-pulse status-scope-pulse--bad'} />
          <p className="status-scope-state">{ok ? 'Up' : 'Down'}</p>
        </div>
        <div className="status-scope-clock">
          <p className="status-scope-clock-value">{formatClock(elapsedMs)}</p>
          <p className="status-scope-clock-label">watching since your click</p>
        </div>
        <dl className="status-scope-tiles">
          <div>
            <dt>Seated</dt>
            <dd>
              {formatCount(occupancy)}
              <span> {formatPerMinute(clientRate)}</span>
            </dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{formatCount(rooms)}</dd>
          </div>
          <div>
            <dt>Messages</dt>
            <dd>
              {formatCount(documents)}
              <span> {formatPerMinute(messageRate)}</span>
            </dd>
          </div>
          <div>
            <dt>Hop</dt>
            <dd>
              {last ? `${last.latencyMs} ms` : '—'}
              <span> p95 {latencies.length ? `${p95} ms` : '—'}</span>
            </dd>
          </div>
          <div>
            <dt>Probe</dt>
            <dd>
              {formatHz(hz || configuredHz)}
              <span> {success.toFixed(0)}% up</span>
            </dd>
          </div>
        </dl>
      </div>

      <svg
        className="status-scope-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Realtime up ${formatClock(elapsedMs)}, ${samples.length} probes at ${formatHz(hz || configuredHz)}, ${formatCount(occupancy)} clients`}
      >
        <defs>
          <linearGradient id={`${uid}-lat`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ok ? '#3ee0b0' : '#ff6b4a'} stopOpacity="0.38" />
            <stop offset="100%" stopColor={ok ? '#3ee0b0' : '#ff6b4a'} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-vol`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6b8cff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6b8cff" stopOpacity="0.2" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((t) => (
          <g key={t.s}>
            <line
              className="status-scope-grid"
              x1={t.x}
              x2={t.x}
              y1={LAT_TOP}
              y2={VOL_BOTTOM}
            />
            <text className="status-scope-axis" x={t.x + 4} y={HEIGHT - 6}>
              {t.label}
            </text>
          </g>
        ))}
        {maxY >= 80 ? (
          <line
            className="status-scope-grid status-scope-grid--emph"
            x1="0"
            x2={WIDTH}
            y1={LAT_BOTTOM - (80 / maxY) * LAT_H}
            y2={LAT_BOTTOM - (80 / maxY) * LAT_H}
          />
        ) : null}
        <text className="status-scope-axis" x="6" y={LAT_TOP + 10}>
          {maxY} ms
        </text>
        {maxY >= 80 ? (
          <text className="status-scope-axis" x="6" y={LAT_BOTTOM - (80 / maxY) * LAT_H - 4}>
            80 ms
          </text>
        ) : null}
        <text className="status-scope-axis" x="6" y={VOL_TOP + 10}>
          occupancy
        </text>
        <text className="status-scope-axis" x={WIDTH - 8} y={VOL_TOP + 10} textAnchor="end">
          {maxV}
        </text>

        {bars.map((b, i) => (
          <rect
            key={`v-${i}`}
            className={b.ok ? 'status-scope-bar' : 'status-scope-bar status-scope-bar--bad'}
            x={b.x}
            y={VOL_TOP + b.y}
            width={b.w}
            height={Math.max(b.h, 0)}
            rx="1.2"
            fill={b.ok ? `url(#${uid}-vol)` : undefined}
          />
        ))}

        {area ? <path className="status-scope-area" d={area} fill={`url(#${uid}-lat)`} /> : null}
        {line ? (
          <>
            <path className="status-scope-line status-scope-line--glow" d={line} filter={`url(#${uid}-glow)`} />
            <path className="status-scope-line" d={line} />
          </>
        ) : (
          <text className="status-scope-empty" x="24" y={(LAT_TOP + LAT_BOTTOM) / 2}>
            Waiting on the first probe from this click
          </text>
        )}

        {latPts.map((p, i) => (
          <circle
            key={`d-${i}`}
            className={samples[i]?.ok ? 'status-scope-dot' : 'status-scope-dot status-scope-dot--bad'}
            cx={p.x}
            cy={p.y}
            r={i === latPts.length - 1 ? 3.2 : 2.1}
          />
        ))}

        <line className="status-scope-now" x1={playX} x2={playX} y1={LAT_TOP} y2={VOL_BOTTOM} />
      </svg>

      <div className="status-scope-deck">
        <section className="status-scope-mix" aria-label="Room mix">
          <h3>Where people sit</h3>
          {mix.length === 0 ? (
            <p className="status-scope-empty-copy">No live rooms yet — empty is honest at this scale.</p>
          ) : (
            <ul>
              {mix.map((row) => (
                <li key={row.name}>
                  <div className="status-scope-mix-meta">
                    <span>{ROOM_LABEL[row.name] || row.name}</span>
                    <span>
                      {formatCount(row.clients)} seated · {formatCount(row.rooms)} rooms
                    </span>
                  </div>
                  <span
                    className="status-scope-mix-bar"
                    style={{ width: `${Math.max(6, (Math.max(row.clients, row.rooms) / mixMax) * 100)}%` }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="status-scope-tape" aria-label="Probe tape">
          <h3>Probe tape</h3>
          <ol>
            {tape.length === 0 ? (
              <li>Waiting on the first hop from this click.</li>
            ) : (
              tape.map((s) => (
                <li key={s.elapsedMs} data-ok={s.ok ? 'true' : 'false'}>
                  <span>{formatClock(s.elapsedMs)}</span>
                  <span>{s.latencyMs} ms</span>
                  <span>{formatCount(s.clients ?? 0)}c</span>
                  <span>{formatCount(s.documents ?? 0)} msg</span>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>

      <div className="status-scope-stats">
        <p>
          <span>process</span> {processUp > 0 ? formatUptime(processUp) : '—'}
        </p>
        <p>
          <span>p50 hop</span> {latencies.length ? `${p50} ms` : '—'}
        </p>
        <p>
          <span>sessions</span> {sessions > 0 ? formatCount(sessions) : '—'}
        </p>
        <p>
          <span>address</span> {payload?.publicAddress || 'loopback'}
        </p>
        <p className="status-scope-stats-end">
          {error && !ok
            ? error
            : 'This window starts at your click. Occupancy and indexed messages are live from the Colyseus process — they grow as the fleet does.'}
        </p>
      </div>
    </div>
  )
}
