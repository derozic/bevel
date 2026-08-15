'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { bevelTagPath } from '@/lib/bevel'
import type { FolkEntityKind } from '@bevel/schema'

export function FolksonomyChips({
  kind,
  id,
  initialTags,
  editable = true,
  compact = false,
}: {
  kind: FolkEntityKind
  id: string
  initialTags?: string[]
  editable?: boolean
  compact?: boolean
}) {
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(
        `/api/tags?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
        { credentials: 'include', cache: 'no-store' },
      )
      const data = (await res.json().catch(() => ({}))) as { tags?: string[] }
      if (Array.isArray(data.tags)) setTags(data.tags)
    } catch {
      /* keep local */
    }
  }, [kind, id])

  useEffect(() => {
    void load()
  }, [load])

  async function apply(raw: string) {
    const slug = raw.trim()
    if (!slug || busy) return
    setBusy(true)
    setDraft('')
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, kind, id }),
      })
      const data = (await res.json().catch(() => ({}))) as { tags?: string[] }
      if (Array.isArray(data.tags)) setTags(data.tags)
    } finally {
      setBusy(false)
    }
  }

  async function remove(slug: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, kind, id }),
      })
      const data = (await res.json().catch(() => ({}))) as { tags?: string[] }
      if (Array.isArray(data.tags)) setTags(data.tags)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-1' : 'space-y-1.5'}>
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground"
          >
            <Link href={bevelTagPath(tag)} className="hover:text-accent">
              {tag}
            </Link>
            {editable ? (
              <button
                type="button"
                className="opacity-50 hover:opacity-100"
                aria-label={`Remove ${tag}`}
                onClick={() => void remove(tag)}
              >
                <XMarkIcon className="size-3" aria-hidden />
              </button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <input
            className="min-w-[6.5rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-[11px] text-foreground outline-none placeholder:text-muted"
            value={draft}
            disabled={busy}
            placeholder={tags.length ? '+ tag' : 'Add a tag'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                void apply(draft.replace(/,/g, ''))
              }
            }}
            onBlur={() => {
              if (draft.trim()) void apply(draft)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
