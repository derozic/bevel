'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BEVEL_COPY } from '@/lib/bevel'
import type { FleetChannelSummary } from '@/lib/fleet-channels'

const EMPTY = { slug: '', name: '', tags: '' }

export function CreateChannelModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (channel: FleetChannelSummary) => void
}) {
  const [slug, setSlug] = useState(EMPTY.slug)
  const [name, setName] = useState(EMPTY.name)
  const [tags, setTags] = useState(EMPTY.tags)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setSlug(EMPTY.slug)
    setName(EMPTY.name)
    setTags(EMPTY.tags)
    setError(null)
    setSaving(false)
  }, [open])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim().replace(/^[#^]/, ''))
        .filter(Boolean)
      const res = await fetch('/api/fleet/channels', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim() || undefined,
          tags: tagList,
          defaultAgentIds: ['hermes', 'johnny'],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        detail?: string
        slug?: string
        name?: string
        tags?: string[]
        channel?: { slug?: string; name?: string; tags?: string[] }
      }
      if (!res.ok) {
        setError(
          data.error ??
            (typeof data.detail === 'string' ? data.detail : undefined) ??
            'Could not create channel',
        )
        setSaving(false)
        return
      }
      const nested = data.channel
      const createdSlug = String(nested?.slug ?? data.slug ?? slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '')
      const displayName =
        (nested?.name && String(nested.name).trim()) ||
        (data.name && String(data.name).trim()) ||
        name.trim() ||
        createdSlug
      onCreated({
        slug: createdSlug,
        name: displayName,
        tags: Array.isArray(nested?.tags)
          ? nested.tags.map(String)
          : Array.isArray(data.tags)
            ? data.tags.map(String)
            : tagList,
      })
    } catch {
      setError('Could not create channel')
      setSaving(false)
    }
  }

  const fieldClass =
    'mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900/10'

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-medium text-ink-900">{BEVEL_COPY.newChannel}</h2>
        <p className="mt-1 text-sm text-ink-600">
          Shared thread for the crew — history stays in the channel.
        </p>

        <label className="mt-4 block text-xs font-semibold text-ink-900">
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ops"
            className={fieldClass}
            required
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-ink-900">
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ops"
            className={fieldClass}
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-ink-900">
          Tags (comma-separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="deploy, caddy, hermes"
            className={fieldClass}
          />
        </label>

        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:border-ink-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-ink-900 bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}