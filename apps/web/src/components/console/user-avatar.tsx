'use client'

import Image from 'next/image'
import Link from 'next/link'

export function UserAvatar({
  user,
}: {
  user?: { email?: string; name?: string; picture?: string }
}) {
  const label = user?.name || user?.email || 'Account'
  const initial = (label[0] || 'B').toUpperCase()
  return (
    <Link
      href="/console/settings"
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 hover:bg-surface-raised transition-colors"
      title={label}
    >
      {user?.picture ? (
        <Image
          src={user.picture}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
          {initial}
        </span>
      )}
      <span className="hidden max-w-[10rem] truncate text-xs font-medium text-foreground md:inline">
        {label}
      </span>
    </Link>
  )
}
