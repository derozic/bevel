'use client'

import { cn } from '../lib/utils'

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
  className,
}: {
  name: string
  avatarUrl?: string
  email?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const shared = cn('fleet-human-avatar', className)

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        data-size={size}
        className={shared}
      />
    )
  }

  return (
    <span data-size={size} className={shared} aria-hidden>
      {initials(name, email)}
    </span>
  )
}