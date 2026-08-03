'use client'

/**
 * Suite dock: BEVEL mark for product hosts (2x4m, etc.).
 * Placement: trailing nav only — immediately left of user avatar / auth.
 * Do not render next to the product logo/wordmark (crowds brand).
 * Desktop hover/focus → GET {baseUrl}/api/suite/launch (unread + latest preview).
 *
 * SOURCE OF TRUTH: derozic/bevel packages/suite-chrome
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { BevelCutMark } from './BevelCutMark'
import { badgeLabel, relativeTime } from './helpers'
import type { BevelSuiteLaunch } from './types'
import './suite-dock.css'

export type { BevelSuiteLaunch }

const POLL_MS = 45_000
const DEFAULT_BASE = 'https://bevel.2x4m.cc'

export interface SuiteDockLaunchProps {
  className?: string
  /**
   * Bevel workspace origin (e.g. https://bevel.2x4m.cc).
   * Required for product hosts — do not hardcode product URLs inside this package.
   */
  baseUrl: string
}

export function SuiteDockLaunch({ className = '', baseUrl }: SuiteDockLaunchProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<BevelSuiteLaunch | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const fetchedOnce = useRef(false)

  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '')
  const homeHref = base

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`${base}/api/suite/launch`, {
          credentials: 'include',
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as BevelSuiteLaunch
        if (signal?.aborted) return
        setData(json)
        fetchedOnce.current = true
      } catch {
        if (signal?.aborted) return
        setError(true)
        if (!fetchedOnce.current) {
          setData({
            ok: false,
            signedIn: false,
            unreadCount: 0,
            primaryHref: homeHref,
            primaryLabel: 'Open BEVEL',
            latest: null,
            starts: [
              { label: 'Home', href: `${homeHref}/bevel` },
              { label: 'Timeline', href: `${homeHref}/bevel/timeline` },
            ],
          })
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [base, homeHref],
  )

  useEffect(() => {
    const ac = new AbortController()
    const idle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => void load(ac.signal), { timeout: 2500 })
        : window.setTimeout(() => void load(ac.signal), 400)
    const interval = window.setInterval(() => void load(ac.signal), POLL_MS)
    return () => {
      ac.abort()
      if (typeof cancelIdleCallback === 'function' && typeof idle === 'number') {
        try {
          cancelIdleCallback(idle as number)
        } catch {
          /* ignore */
        }
      } else {
        window.clearTimeout(idle as number)
      }
      window.clearInterval(interval)
    }
  }, [load])

  const onEnter = () => {
    setOpen(true)
    if (!fetchedOnce.current || error) void load()
  }

  const unread = data?.unreadCount ?? 0
  const badge = badgeLabel(unread)
  const aria =
    unread > 0
      ? `BEVEL, ${unread} new message${unread === 1 ? '' : 's'}`
      : 'BEVEL workspace'

  const primaryHref = data?.primaryHref || homeHref
  const primaryLabel = data?.primaryLabel || 'Open BEVEL'

  return (
    <div
      ref={rootRef}
      className={`bevel-nav-launch ${open ? 'is-open' : ''} ${className}`.trim()}
      onMouseEnter={onEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => onEnter()}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false)
        }
      }}
    >
      <a
        href={primaryHref}
        className="bevel-nav-launch-trigger"
        aria-label={aria}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title="BEVEL"
      >
        <span className="bevel-nav-launch-mark" aria-hidden>
          <BevelCutMark />
        </span>
        {badge ? (
          <span className="bevel-nav-launch-badge" aria-hidden>
            {badge}
          </span>
        ) : null}
      </a>

      <div
        id={panelId}
        role="dialog"
        aria-label="BEVEL workspace preview"
        className="bevel-nav-launch-panel"
        hidden={!open}
      >
        <div className="bevel-nav-launch-panel-head">
          <span className="bevel-nav-launch-kicker">BEVEL</span>
          {data?.workspace?.label ? (
            <span className="bevel-nav-launch-workspace">{data.workspace.label}</span>
          ) : null}
        </div>

        {loading && !data ? (
          <p className="bevel-nav-launch-status">Checking the wire…</p>
        ) : null}

        {unread > 0 ? (
          <p className="bevel-nav-launch-count">
            <strong>{unread}</strong> new message{unread === 1 ? '' : 's'}
          </p>
        ) : data?.signedIn ? (
          <p className="bevel-nav-launch-count bevel-nav-launch-count--quiet">Caught up</p>
        ) : (
          <p className="bevel-nav-launch-count bevel-nav-launch-count--quiet">
            Jump into the crew
          </p>
        )}

        {data?.latest ? (
          <a href={data.latest.href} className="bevel-nav-launch-latest">
            <div className="bevel-nav-launch-latest-meta">
              <span className="bevel-nav-launch-actor">
                {data.latest.actorLabel || 'Someone'}
              </span>
              {data.latest.channelSlug ? (
                <span className="bevel-nav-launch-channel">#{data.latest.channelSlug}</span>
              ) : null}
              <span className="bevel-nav-launch-time">
                {relativeTime(data.latest.createdAt)}
              </span>
            </div>
            <p className="bevel-nav-launch-preview">
              {data.latest.bodyPreview || 'New activity in the workspace'}
            </p>
          </a>
        ) : null}

        <a href={primaryHref} className="bevel-nav-launch-cta">
          {primaryLabel}
        </a>

        {data?.starts && data.starts.length > 0 ? (
          <div className="bevel-nav-launch-starts">
            {data.starts.map((s: { label: string; href: string }) => (
              <a key={s.href} href={s.href} className="bevel-nav-launch-start">
                {s.label}
              </a>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="bevel-nav-launch-footnote">
            Live preview unavailable — open BEVEL anyway.
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** @deprecated Prefer SuiteDockLaunch */
export const BevelNavLaunch = SuiteDockLaunch
export type BevelNavLaunchProps = SuiteDockLaunchProps

export default SuiteDockLaunch
