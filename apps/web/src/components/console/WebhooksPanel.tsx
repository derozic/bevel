'use client'

import { useEffect, useState } from 'react'

type Hook = {
  id: string
  name: string
  direction: 'inbound' | 'outbound'
  targetKind: string
  targetId: string
  url: string
  inboundUrl?: string | null
  enabled: boolean
  lastStatus?: string | null
  secret?: string
}

export function WebhooksPanel() {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [error, setError] = useState<string | null>(null)
  const [secretOnce, setSecretOnce] = useState<Record<string, string>>({})
  const [name, setName] = useState('Workflow')
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound')
  const [targetKind, setTargetKind] = useState('track')
  const [targetId, setTargetId] = useState('ops')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [eventFilter, setEventFilter] = useState('ftue.*,workflow.*,message.created')
  const [catalog, setCatalog] = useState<Array<{ id: string; family: string; description: string }>>(
    [],
  )
  const [deliveries, setDeliveries] = useState<
    Record<string, Array<{ id: string; event: string; status: string; createdAt?: string }>>
  >({})

  async function load() {
    try {
      const res = await fetch('/api/webhooks', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as {
        webhooks?: Hook[]
        error?: string
        detail?: string
      }
      if (!res.ok) {
        setError(data.detail || data.error || 'Could not load webhooks')
        return
      }
      setHooks(data.webhooks ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed')
    }
  }

  useEffect(() => {
    void load()
    void fetch('/api/webhooks/events')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.events)) setCatalog(d.events)
      })
      .catch(() => undefined)
  }, [])

  async function create() {
    setBusy(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          direction,
          targetKind,
          targetId,
          url: direction === 'outbound' ? url : '',
          events: eventFilter
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        webhook?: Hook
        detail?: string
        error?: string
      }
      if (!res.ok || !data.webhook) {
        setError(data.detail || data.error || 'Create failed')
        return
      }
      if (data.webhook.secret) {
        setSecretOnce((prev) => ({ ...prev, [data.webhook!.id]: data.webhook!.secret! }))
      }
      setHooks((prev) => [data.webhook!, ...prev])
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/webhooks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    setHooks((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <section id="webhooks" className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Webhooks</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Workflows, FTUE, and room lifecycle share one event bus. Subscribe
          with <code className="font-mono text-[11px]">ftue.*</code> or
          pick specific events. Inbound FTUE can welcome a first-time user
          into their Hermes conversation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-muted">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          Direction
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')}
          >
            <option value="inbound">Inbound (workflow ends in Bevel)</option>
            <option value="outbound">Outbound (workflow starts from Bevel)</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Room
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={targetKind}
            onChange={(e) => setTargetKind(e.target.value)}
          >
            <option value="track">Track</option>
            <option value="conversation">Conversation</option>
            <option value="any">Any room</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          {targetKind === 'conversation' ? 'dm-… slug' : 'Track slug'}
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder={targetKind === 'conversation' ? 'dm-usr-hermes' : 'ops'}
          />
        </label>
        {direction === 'outbound' ? (
          <label className="text-xs font-semibold text-muted sm:col-span-2 lg:col-span-1">
            Destination URL
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://n8n.example/webhook/bevel"
            />
          </label>
        ) : (
          <div className="flex items-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create inbound
            </button>
          </div>
        )}
      </div>
      <label className="block text-xs font-semibold text-muted">
        Events (comma-separated; families like ftue.* allowed)
        <input
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
        />
      </label>
      {catalog.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted">
          {catalog.map((e) => e.id).join(' · ')}
        </p>
      ) : null}
      {direction === 'outbound' ? (
        <button
          type="button"
          disabled={busy || !url}
          onClick={() => void create()}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create outbound
        </button>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="space-y-3">
        {hooks.map((hook) => (
          <li
            key={hook.id}
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{hook.name}</p>
                <p className="text-xs text-muted">
                  {hook.direction} · {hook.targetKind}
                  {hook.targetId ? ` · ${hook.targetId}` : ''}
                  {hook.lastStatus ? ` · last ${hook.lastStatus}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={() => void remove(hook.id)}
              >
                Remove
              </button>
            </div>
            {hook.direction === 'inbound' && hook.inboundUrl ? (
              <p className="mt-2 break-all font-mono text-[11px] text-foreground">
                POST {hook.inboundUrl}
              </p>
            ) : null}
            {hook.direction === 'outbound' && hook.url ? (
              <p className="mt-2 break-all font-mono text-[11px] text-muted">
                → {hook.url}
              </p>
            ) : null}
            {secretOnce[hook.id] ? (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 font-mono text-[11px] text-amber-900">
                Secret (copy now): {secretOnce[hook.id]}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-2 text-[11px] text-muted underline"
              onClick={async () => {
                const res = await fetch(
                  `/api/webhooks/${encodeURIComponent(hook.id)}/deliveries`,
                  { credentials: 'include' },
                )
                const data = await res.json().catch(() => ({}))
                setDeliveries((prev) => ({
                  ...prev,
                  [hook.id]: data.deliveries ?? [],
                }))
              }}
            >
              Delivery log
            </button>
            {deliveries[hook.id]?.length ? (
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
                {deliveries[hook.id]!.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    {d.status} · {d.event} · {d.createdAt}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
