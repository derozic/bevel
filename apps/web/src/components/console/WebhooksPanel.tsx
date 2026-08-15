'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  webhookEventLabel,
  webhookSubscriptionOptions,
  type WebhookDirection,
} from '@bevel/schema'

type Hook = {
  id: string
  name: string
  direction: WebhookDirection
  targetKind: string
  targetId: string
  url: string
  inboundUrl?: string | null
  enabled: boolean
  lastStatus?: string | null
  secret?: string
  events?: string[]
}

const FIELD =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70'

function EventSubscriptionField({
  value,
  onChange,
  direction,
}: {
  value: string[]
  onChange: (next: string[]) => void
  direction: WebhookDirection
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const options = useMemo(
    () => webhookSubscriptionOptions(direction),
    [direction],
  )
  const selected = value.length === 0 ? ['*'] : value
  const remaining = options.filter((item) => !selected.includes(item.id))

  useEffect(() => {
    if (!open) return
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false)
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function add(id: string) {
    if (id === '*') {
      onChange(['*'])
      setOpen(false)
      return
    }
    const next = selected.filter((item) => item !== '*')
    if (!next.includes(id)) next.push(id)
    onChange(next)
  }

  function remove(id: string) {
    const next = selected.filter((item) => item !== id)
    onChange(next.length === 0 ? ['*'] : next)
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="text-xs font-semibold text-muted">Event subscriptions</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${FIELD} flex min-h-[42px] flex-wrap items-center gap-1.5 text-left`}
      >
        {selected.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {webhookEventLabel(id)}
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove ${webhookEventLabel(id)}`}
              className="rounded p-0.5 text-muted hover:bg-background hover:text-foreground"
              onClick={(ev) => {
                ev.stopPropagation()
                ev.preventDefault()
                remove(id)
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  ev.stopPropagation()
                  remove(id)
                }
              }}
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </span>
          </span>
        ))}
        <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted" />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {remaining.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">All events selected</li>
          ) : (
            remaining.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-background"
                  onClick={() => add(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

export function WebhooksPanel() {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [error, setError] = useState<string | null>(null)
  const [secretOnce, setSecretOnce] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [direction, setDirection] = useState<WebhookDirection>('outbound')
  const [targetKind, setTargetKind] = useState('track')
  const [targetId, setTargetId] = useState('ops')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<string[]>(['*'])
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
  }, [])

  async function create() {
    setBusy(true)
    try {
      const fallbackName =
        name.trim() ||
        (direction === 'inbound'
          ? `Incoming · ${targetId || 'any'}`
          : `Outgoing · ${targetId || 'any'}`)
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fallbackName,
          direction,
          targetKind,
          targetId,
          url: direction === 'outbound' ? url : '',
          events,
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
      setName('')
      setUrl('')
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

  const helper =
    direction === 'outbound'
      ? 'Enter a URL to receive a POST when something happens in a track or conversation.'
      : 'We mint a URL. POST to it to land a turn in the track or conversation.'

  return (
    <section id="webhooks" className="space-y-6 rounded-2xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Add a webhook</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{helper}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">
          Direction
          <select
            className={FIELD}
            value={direction}
            onChange={(e) => setDirection(e.target.value as WebhookDirection)}
          >
            <option value="outbound">Outgoing — Bevel calls you</option>
            <option value="inbound">Incoming — you post into Bevel</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Name
          <input
            className={FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional — defaults from the room"
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          Room
          <select
            className={FIELD}
            value={targetKind}
            onChange={(e) => setTargetKind(e.target.value)}
          >
            <option value="track">Track</option>
            <option value="conversation">Conversation</option>
            <option value="any">Any room</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          {targetKind === 'conversation' ? 'Conversation' : targetKind === 'any' ? 'Slug (optional)' : 'Track'}
          <input
            className={FIELD}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder={targetKind === 'conversation' ? 'dm-usr-hermes' : 'ops'}
          />
        </label>
        {direction === 'outbound' ? (
          <label className="text-xs font-semibold text-muted sm:col-span-2">
            URL
            <input
              className={FIELD}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://<your URL path>"
              inputMode="url"
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="sm:col-span-2">
          <EventSubscriptionField
            value={events}
            onChange={setEvents}
            direction={direction}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={busy || (direction === 'outbound' && !url.trim())}
        onClick={() => void create()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {direction === 'inbound' ? 'Create incoming URL' : 'Add webhook'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {hooks.length > 0 ? (
        <ul className="space-y-3 border-t border-border pt-6">
          {hooks.map((hook) => (
            <li
              key={hook.id}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{hook.name}</p>
                  <p className="text-xs text-muted">
                    {hook.direction === 'inbound' ? 'Incoming' : 'Outgoing'}
                    {hook.targetKind === 'track' && hook.targetId
                      ? ` · ~${hook.targetId}`
                      : hook.targetKind === 'conversation' && hook.targetId
                        ? ` · ${hook.targetId}`
                        : ' · any room'}
                    {hook.lastStatus ? ` · last ${hook.lastStatus}` : ''}
                  </p>
                  {hook.events?.length ? (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {hook.events.map((id) => (
                        <span
                          key={id}
                          className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          {webhookEventLabel(id)}
                        </span>
                      ))}
                    </p>
                  ) : null}
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
                  {hook.url}
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
                      {d.status} · {webhookEventLabel(d.event)} · {d.createdAt}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
