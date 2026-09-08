'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { processColorForKey } from '@/lib/cmyk-process'
import { rewriteLocalWorkspaceHref } from '@/lib/local-workspace-href'

export function BrandSquare({
  href,
  label,
  caption,
  logoUrl,
  processKey,
  process,
  active,
  escalated,
  title,
  onClick,
  onContextMenu,
  busy,
}: {
  href: string
  label: string
  caption?: string
  logoUrl?: string | null
  processKey?: string
  process?: string
  active?: boolean
  escalated?: boolean
  title?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  onContextMenu?: (e: MouseEvent<HTMLAnchorElement>) => void
  busy?: boolean
}) {
  const wash = process || processColorForKey(processKey || label)
  const style = { '--tile-process': wash } as CSSProperties
  const mark = logoUrl?.trim()
  const initial = (label.replace(/^[~^#]/, '').trim()[0] || '?').toUpperCase()
  const crossHost = /^https?:\/\//i.test(href)
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const next = rewriteLocalWorkspaceHref(href)
    if (next !== href) {
      event.preventDefault()
      window.location.assign(next)
      return
    }
    onClick?.(event)
  }
  const tileProps = {
    href,
    onClick: handleClick,
    onContextMenu,
    'data-active': active ? 'true' : 'false',
    'data-escalated': escalated ? 'true' : 'false',
    'aria-busy': busy || undefined,
    title: title || caption || label,
    className: 'bevel-brand-square',
    style,
  } as const

  const body = (
    <>
      <span className="bevel-brand-square-face" aria-hidden>
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mark} alt="" className="bevel-brand-square-logo" />
        ) : (
          <span className="bevel-brand-square-fallback">{initial}</span>
        )}
      </span>
      <span className="bevel-brand-square-label">{label}</span>
      {caption && caption !== label ? (
        <span className="bevel-brand-square-caption">{caption}</span>
      ) : null}
    </>
  )

  if (crossHost) {
    return <a {...tileProps}>{body}</a>
  }

  return <Link {...tileProps}>{body}</Link>
}

export function BrandSquareGrid({
  children,
  label,
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <div role="list" aria-label={label} className="bevel-brand-square-grid">
      {children}
    </div>
  )
}
