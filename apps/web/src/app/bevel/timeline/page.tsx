'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  BellAlertIcon,
  CheckIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline'
import { bevelChannelPath } from '@/lib/bevel'

type TimelineItem = {
  id: string
  kind: string
  priority: string
  actorLabel: string
  bodyPreview: string
  channelSlug?: string | null
  createdAt?: string | null
  readAt?: string | null
  ackedAt?: string | null
  unread?: boolean
  escalated?: boolean
  payload?: {
    handle?: string
    messageId?: string
    personalAgentId?: string | null
    notify?: boolean
  }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

export default function TimelinePage() {
  const { status } = useSession()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'mention' | 'escalation'>('all')
  const [handle, setHandle] = useState<string | null>(null)
  const [personalAgentId, setPersonalAgentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs =
        filter === 'all' ? '' : `?kind=${encodeURIComponent(filter)}`
      const res = await fetch(`/api/timeline${qs}`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || data.error || 'Could not load timeline')
        setItems([])
        return
      }
      setItems(Array.isArray(data.items) ? data.items : [])
      setHandle(data.handle ?? null)
      setPersonalAgentId(data.personalAgentId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (status === 'authenticated') void load()
    else if (status === 'unauthenticated') setLoading(false)
  }, [status, load])

  const mark = async (id: string, action: 'read' | 'ack') => {
    const res = await fetch(`/api/timeline/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) void load()
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Timeline</h1>
        <p className="mt-2 text-muted">Sign in to see @mentions and ^escalations.</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Timeline
          </h1>
          <p className="mt-1 text-sm text-muted">
            Reverse-chrono feed. @ is a soft mention; ^ escalates with full
            notify
            {personalAgentId ? (
              <>
                {' '}
                via your personal agent{' '}
                <span className="font-mono text-foreground">
                  {personalAgentId}
                </span>
              </>
            ) : null}
            {handle ? (
              <>
                {' '}
                · you are{' '}
                <span className="font-mono text-foreground">@{handle}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs">
          {(['all', 'mention', 'escalation'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={
                filter === k
                  ? 'rounded-md bg-accent px-2.5 py-1 font-medium text-white'
                  : 'rounded-md px-2.5 py-1 text-muted hover:text-foreground'
              }
            >
              {k === 'all' ? 'All' : k === 'mention' ? '@ Mentions' : '^ Escalations'}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {error}
          <button
            type="button"
            className="ml-3 text-accent underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
          <ChatBubbleLeftIcon className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-medium text-foreground">No items yet</p>
          <p className="mt-1 text-sm text-muted">
            When someone writes @yourhandle or ^yourhandle in a bevel, it shows
            up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const escalated = item.kind === 'escalation' || item.escalated
            const channelHref = item.channelSlug
              ? bevelChannelPath(item.channelSlug)
              : null
            return (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-background/80 p-4 shadow-sm"
                data-unread={item.unread ? 'true' : 'false'}
                data-kind={item.kind}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={
                      escalated
                        ? 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700'
                        : 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent'
                    }
                    aria-hidden
                  >
                    {escalated ? (
                      <BellAlertIcon className="h-4 w-4" />
                    ) : (
                      <ChatBubbleLeftIcon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {item.actorLabel || 'Someone'}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted">
                        {escalated ? '^escalation' : '@mention'}
                      </span>
                      {item.channelSlug ? (
                        <Link
                          href={channelHref!}
                          className="text-xs font-mono text-accent hover:underline"
                        >
                          ~{item.channelSlug}
                        </Link>
                      ) : null}
                      <span className="text-xs text-muted">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {item.bodyPreview}
                    </p>
                    {escalated && item.payload?.personalAgentId ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Personal agent:{' '}
                        <span className="font-mono">
                          {item.payload.personalAgentId}
                        </span>
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.unread ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted hover:text-foreground"
                          onClick={() => void mark(item.id, 'read')}
                        >
                          <CheckIcon className="h-3 w-3" />
                          Mark read
                        </button>
                      ) : null}
                      {escalated && !item.ackedAt ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-500/25"
                          onClick={() => void mark(item.id, 'ack')}
                        >
                          Ack escalation
                        </button>
                      ) : null}
                      {channelHref ? (
                        <Link
                          href={channelHref}
                          className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:underline"
                        >
                          Open channel
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
