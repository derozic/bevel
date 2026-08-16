'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import { processColorForKey } from '@/lib/cmyk-process'

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

  return (
    <Link
      href={href}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-active={active ? 'true' : 'false'}
      data-escalated={escalated ? 'true' : 'false'}
      aria-busy={busy || undefined}
      title={title || caption || label}
      className="bevel-brand-square"
      style={style}
    >
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
    </Link>
  )
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
