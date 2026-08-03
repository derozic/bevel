'use client'

/**
 * Parallel Agent Trace pane — verb · object · outcome cards next to chat.
 * Hydrates from GET /api/traces; polled while open. Never blocks chat.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@bevel/ui'

export type TraceEvent = {
  id: string
  runId: string
  agentId: string
  kind: string
  title: string
  summary?: string | null
  bodyMarkdown?: string | null
  status?: string | null
  ts?: string | null
  durationMs?: number | null
  payload?: Record<string, unknown>
}

type TraceListResponse = {
  ok?: boolean
  items?: TraceEvent[]
  events?: TraceEvent[]
  error?: string
  detail?: string
}

function kindIcon(kind: string) {
  if (kind === 'run_error' || kind === 'error') return ExclamationTriangleIcon
  if (kind === 'thinking' || kind === 'planning' || kind === 'model') return CpuChipIcon
  return ClockIcon
}

function statusTone(status?: string | null, kind?: string): 'ok' | 'error' | 'running' | 'neutral' {
  if (kind === 'run_error' || status === 'error') return 'error'
  if (status === 'running' || status === 'pending' || kind === 'run_start') return 'running'
  if (status === 'ok' || kind === 'run_end') return 'ok'
  return 'neutral'
}

function formatTime(ts?: string | null, clock24h = false): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !clock24h,
    })
  } catch {
    return ''
  }
}

function groupByRun(events: TraceEvent[]): { runId: string; events: TraceEvent[] }[] {
  const order: string[] = []
  const map = new Map<string, TraceEvent[]>()
  // API returns newest-first; keep that run order
  for (const ev of events) {
    const rid = ev.runId || 'unknown'
    if (!map.has(rid)) {
      map.set(rid, [])
      order.push(rid)
    }
    map.get(rid)!.push(ev)
  }
  // Newest runs first (API page is chronological / oldest-first overall)
  return order
    .map((runId) => {
      const list = map.get(runId)!
      // chronological within run for reading
      list.sort((a, b) => {
        const ta = a.ts ? Date.parse(a.ts) : 0
        const tb = b.ts ? Date.parse(b.ts) : 0
        return ta - tb
      })
      return { runId, events: list }
    })
    .reverse()
}

function sentenceFor(ev: TraceEvent): string {
  // Verb · object · outcome — title is already human; summary is detail
  const title = ev.title?.trim() || ev.kind
  if (ev.summary && ev.summary.trim() && ev.summary.trim() !== title) {
    return title
  }
  return title
}

export function TracePane({
  roomKind,
  roomId,
  tenantId,
  open,
  onClose,
  clock24h = false,
  className,
}: {
  roomKind: 'channel' | 'agent_session' | 'computer' | 'cloud'
  roomId: string
  tenantId: string
  open: boolean
  onClose: () => void
  clock24h?: boolean
  className?: string
}) {
  const [items, setItems] = useState<TraceEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [rawMode, setRawMode] = useState(false)

  const fetchTraces = useCallback(async (signal?: AbortSignal) => {
    if (!roomId || !tenantId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        roomKind,
        roomId,
        tenantId,
        limit: '80',
      })
      const res = await fetch(`/api/traces?${qs}`, {
        credentials: 'include',
        signal,
      })
      const data = (await res.json().catch(() => ({}))) as TraceListResponse
      if (!res.ok) {
        setError(data.detail || data.error || `HTTP ${res.status}`)
        setItems([])
        return
      }
      const list = data.items ?? data.events ?? []
      setItems(Array.isArray(list) ? list : [])
      setError(null)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to load traces')
    } finally {
      setLoading(false)
    }
  }, [roomKind, roomId, tenantId])

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    void fetchTraces(ac.signal)
    // Poll while open — faster when a run looks live
    const id = window.setInterval(() => {
      void fetchTraces()
    }, 2500)
    return () => {
      ac.abort()
      window.clearInterval(id)
    }
  }, [open, fetchTraces])

  const runs = useMemo(() => groupByRun(items), [items])

  if (!open) return null

  return (
    <aside
      className={cn('trace-pane', className)}
      aria-label="Agent trace"
      data-raw={rawMode ? 'true' : 'false'}
    >
      <header className="trace-pane__header">
        <div className="trace-pane__title-block">
          <h2 className="trace-pane__title">Trace</h2>
          <p className="trace-pane__subtitle">Agent actions next to chat</p>
        </div>
        <div className="trace-pane__header-actions">
          <button
            type="button"
            className="trace-pane__icon-btn"
            aria-label="Refresh traces"
            onClick={() => void fetchTraces()}
            disabled={loading}
          >
            <ArrowPathIcon className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            className={cn('trace-pane__text-btn', rawMode && 'trace-pane__text-btn--on')}
            onClick={() => setRawMode((v) => !v)}
            aria-pressed={rawMode}
          >
            Raw
          </button>
          <button
            type="button"
            className="trace-pane__icon-btn"
            aria-label="Close trace pane"
            onClick={onClose}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="trace-pane__body">
        {error ? (
          <div className="trace-pane__empty" role="alert">
            <ExclamationTriangleIcon className="trace-pane__empty-icon" />
            <p className="trace-pane__empty-title">Could not load traces</p>
            <p className="trace-pane__empty-hint">{error}</p>
            <button
              type="button"
              className="trace-pane__text-btn"
              onClick={() => void fetchTraces()}
            >
              Retry
            </button>
          </div>
        ) : runs.length === 0 && !loading ? (
          <div className="trace-pane__empty">
            <CpuChipIcon className="trace-pane__empty-icon" />
            <p className="trace-pane__empty-title">No agent activity yet</p>
            <p className="trace-pane__empty-hint">
              @mention an agent in the channel. Dispatch steps (start, reply, errors) appear here.
            </p>
          </div>
        ) : (
          <ul className="trace-pane__runs">
            {runs.map(({ runId, events }) => {
              const head = events[events.length - 1] ?? events[0]
              const isOpen = expanded[runId] ?? true
              const agentId = head?.agentId ?? 'agent'
              const tone = statusTone(head?.status, head?.kind)
              return (
                <li key={runId} className="trace-pane__run" data-tone={tone}>
                  <button
                    type="button"
                    className="trace-pane__run-head"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [runId]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    ) : (
                      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}
                    <span className="trace-pane__run-agent">@{agentId}</span>
                    <span className="trace-pane__run-meta">
                      {events.length} step{events.length === 1 ? '' : 's'}
                      {head?.ts ? ` · ${formatTime(head.ts, clock24h)}` : ''}
                    </span>
                  </button>
                  {isOpen ? (
                    <ol className="trace-pane__steps">
                      {events.map((ev) => {
                        const Icon = kindIcon(ev.kind)
                        const stepTone = statusTone(ev.status, ev.kind)
                        return (
                          <li
                            key={ev.id}
                            className="trace-pane__step"
                            data-tone={stepTone}
                            data-kind={ev.kind}
                          >
                            <span className="trace-pane__step-icon" aria-hidden>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="trace-pane__step-body">
                              <p className="trace-pane__step-title">{sentenceFor(ev)}</p>
                              {ev.summary && !rawMode ? (
                                <p className="trace-pane__step-summary">
                                  {ev.summary.slice(0, 280)}
                                  {ev.summary.length > 280 ? '…' : ''}
                                </p>
                              ) : null}
                              {rawMode ? (
                                <pre className="trace-pane__raw">
                                  {JSON.stringify(
                                    {
                                      kind: ev.kind,
                                      status: ev.status,
                                      durationMs: ev.durationMs,
                                      payload: ev.payload,
                                    },
                                    null,
                                    2,
                                  )}
                                </pre>
                              ) : null}
                              <p className="trace-pane__step-foot">
                                <span>{ev.kind}</span>
                                {ev.durationMs != null ? (
                                  <span>{ev.durationMs}ms</span>
                                ) : null}
                                {ev.ts ? (
                                  <span>{formatTime(ev.ts, clock24h)}</span>
                                ) : null}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
