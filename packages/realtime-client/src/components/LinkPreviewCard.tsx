'use client'

import { useEffect, useState } from 'react'
import type { LinkPreview } from '../lib/link-preview'
import { siteLabel } from '../lib/link-preview'

export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [brain, setBrain] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const site = preview?.site || siteLabel(url)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPreview(null)
    void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: LinkPreview | null) => {
        if (!cancelled && data?.title) setPreview(data)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  async function save() {
    if (brain === 'saving' || brain === 'saved') return
    setBrain('saving')
    try {
      const res = await fetch('/api/brain/clip', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: preview?.title,
          description: preview?.description,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setBrain('saved')
    } catch {
      setBrain('error')
    }
  }

  return (
    <article
      className="bevel-link-card"
      data-loading={loading ? 'true' : 'false'}
      data-kind={preview?.kind || 'generic'}
    >
      <span className="bevel-link-card-orbit" aria-hidden>
        <span />
      </span>
      {preview?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="bevel-link-card-image" src={preview.image} alt="" />
      ) : (
        <span className="bevel-link-card-mark" aria-hidden>
          {(preview?.kicker || site).slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="bevel-link-card-copy">
        <p className="bevel-link-card-site">
          {loading ? 'Reading the page' : preview?.kicker || site}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="bevel-link-card-title"
          aria-label={preview?.cta ? `${preview.cta}: ${preview.title || site}` : undefined}
        >
          {preview?.title || site}
        </a>
        {preview?.description ? (
          <p className="bevel-link-card-desc">{preview.description}</p>
        ) : null}
        {preview?.cta && preview.kind !== 'generic' ? (
          <p className="bevel-link-card-cta">{preview.cta}</p>
        ) : null}
      </div>
      <button type="button" className="bevel-link-card-brain" data-state={brain} onClick={() => void save()}>
        {brain === 'saved' ? 'In 2ndbrain' : brain === 'saving' ? 'Saving' : brain === 'error' ? 'Try again' : '2ndbrain +'}
      </button>
    </article>
  )
}
