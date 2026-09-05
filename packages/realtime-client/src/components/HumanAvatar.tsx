'use client'

import { cn } from '../lib/utils'
import {
  presenceTooltip,
  type PresenceStatus,
} from '../lib/channel-lamp'

function initials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  if (name.length >= 2) return name.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export function HumanAvatar({
  name,
  avatarUrl,
  email,
  size = 'md',
  presence,
  className,
}: {
  name: string
  avatarUrl?: string
  email?: string
  size?: 'sm' | 'md' | 'lg'
  presence?: PresenceStatus
  className?: string
}) {
  const shared = cn('fleet-human-avatar', className)
  const label = presenceTooltip(name, presence)
  const face = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt="" data-size={size} className={shared} />
  ) : (
    <span data-size={size} className={shared} aria-hidden>
      {initials(name, email)}
    </span>
  )

  return (
    <span className="fleet-human-avatar-wrap" title={label} aria-label={label}>
      {face}
      {presence ? (
        <span className="fleet-presence-pip" data-presence={presence} aria-hidden />
      ) : null}
    </span>
  )
}
