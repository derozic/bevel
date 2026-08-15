'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { UserCircleIcon } from '@heroicons/react/24/outline'
import { FolksonomyChips } from '@/components/FolksonomyChips'

type PublicUser = {
  id: string
  name: string
  handle?: string | null
  imageUrl?: string | null
  personalAgentId?: string | null
  role?: string
  tags?: string[]
  org?: string
  jobTitle?: string
}

export default function UserLookupPage() {
  const params = useParams()
  const handle = String(params?.handle || '')
    .toLowerCase()
    .replace(/^[@^]/, '')
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!handle) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/users/by-handle/${encodeURIComponent(handle)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(data.detail || 'User not found')
          setUser(null)
          return
        }
        setUser(data.user ?? null)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [handle])

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        People
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground">
        @{handle || '…'}
      </h1>
      <p className="mt-1 text-sm text-muted">
        @handle soft-mentions land in their timeline. ^handle escalates with
        full notifications and their personal agent.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted">Looking up…</p>
      ) : error || !user ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <UserCircleIcon className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No profile for @{handle}
          </p>
          <p className="mt-1 text-sm text-muted">
            They may not have set a handle yet, or the API is offline.
          </p>
          <Link
            href="/timeline"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Back to timeline
          </Link>
        </div>
      ) : (
        <article className="mt-8 rounded-2xl border border-border bg-surface/60 p-6">
          <div className="flex items-start gap-4">
            {user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="size-16 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent">
                {(user.name || handle).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">
                {user.name || handle}
              </h2>
              <p className="font-mono text-sm text-muted">
                @{user.handle || handle}
              </p>
              {user.personalAgentId ? (
                <p className="mt-2 text-xs text-muted">
                  Personal agent:{' '}
                  <span className="font-mono text-foreground">
                    {user.personalAgentId}
                  </span>
                </p>
              ) : null}
              {user.role ? (
                <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                  {user.role}
                </p>
              ) : null}
              {user.jobTitle || user.org ? (
                <p className="mt-1 text-xs text-muted">
                  {[user.jobTitle, user.org].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Tags
            </p>
            <FolksonomyChips
              kind="person"
              id={user.handle || handle}
              initialTags={user.tags}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-accent/10 px-3 py-1.5 font-medium text-accent">
              @ {user.handle || handle}
            </span>
            <span className="rounded-lg bg-amber-500/15 px-3 py-1.5 font-medium text-amber-800">
              ^ {user.handle || handle}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Soft mention adds to their feed. Escalation triggers all
            notification methods and their personal agent.
          </p>
          <Link
            href="/timeline"
            className="mt-6 inline-block text-sm text-accent hover:underline"
          >
            Open your timeline
          </Link>
        </article>
      )}
    </div>
  )
}
