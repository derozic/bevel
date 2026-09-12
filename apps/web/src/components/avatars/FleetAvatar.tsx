'use client'

import { cn } from '@/lib/utils'
import { AGENT_GLYPHS } from './glyphs'

export function isDarkAgentPlate(accent?: string | null): boolean {
  const raw = (accent || '').trim().replace('#', '')
  if (!raw) return false
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.28
}

/**
 * Sticker-glyph agent mark. Inline SVG so day-part CSS variables
 * (`--agent-plate` / `--agent-face` / `--agent-ink`) restyle the motif
 * for contrast. Heroicons stay on chrome; these are Tegan motifs.
 */
export function FleetAvatar({
  agentId,
  name,
  accent,
  size = 28,
  className,
  src,
}: {
  agentId: string
  name?: string
  accent?: string
  size?: number
  className?: string
  src?: string
}) {
  const id = agentId.trim().toLowerCase()
  const fromSrc = src?.match(/\/avatars\/([a-z0-9-]+)\.(?:svg|jpg)/i)?.[1]
  const glyphId = AGENT_GLYPHS[id] ? id : fromSrc && AGENT_GLYPHS[fromSrc] ? fromSrc : id
  const glyph = AGENT_GLYPHS[glyphId]
  const plate = accent?.trim() || '#64748b'
  const dark = isDarkAgentPlate(plate)
  const label = name?.trim() || id

  return (
    <span
      className={cn('fleet-avatar', className)}
      data-agent={glyphId}
      data-dark-plate={dark ? 'true' : 'false'}
      style={{
        width: size,
        height: size,
        ['--agent-accent' as string]: plate,
      }}
      role="img"
      aria-label={label}
    >
      {glyph ? (
        <span
          className="fleet-avatar-svg"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: glyph }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src || `/avatars/${id}.svg`} alt="" />
      )}
    </span>
  )
}
