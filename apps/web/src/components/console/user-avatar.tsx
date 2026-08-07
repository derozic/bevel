'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  ChevronDownIcon,
  Cog6ToothIcon,
  HomeIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { platformLoginUrl, platformPublicUrl } from '@/lib/platform'
import { BEVEL_PRIVATE_PATH } from '@/lib/bevel'
import { bevelUrls } from '@/components/console/bevel-urls'
import { cn } from '@/lib/utils'

/**
 * Console header account control — avatar + working dropdown.
 * Uses plain <img> for Google avatars (avoids next/image 400 without remotePatterns).
 */
export function UserAvatar({
  user,
}: {
  user?: { email?: string; name?: string; picture?: string }
}) {
  const [open, setOpen] = useState(false)
  const label = user?.name || user?.email || 'Account'
  const initial = (label[0] || 'B').toUpperCase()
  const picture = user?.picture?.trim() || ''
  const chatHref = useMemo(() => bevelUrls.workspaceChat(), [])

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1',
          'hover:bg-surface-raised transition-colors',
          open && 'ring-2 ring-accent/40',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover bg-surface"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Hide broken Google avatar → CSS sibling fallback via data attr
              e.currentTarget.style.display = 'none'
              const fb = e.currentTarget.nextElementSibling as HTMLElement | null
              if (fb) fb.style.display = 'flex'
            }}
          />
        ) : null}
        <span
          className={cn(
            'h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent',
            picture ? 'hidden' : 'flex',
          )}
          aria-hidden={Boolean(picture)}
        >
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-xs font-medium text-foreground md:inline">
          {label}
        </span>
        <ChevronDownIcon
          className={cn('h-3.5 w-3.5 text-muted transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{label}</p>
              {user?.email ? (
                <p className="truncate text-xs text-muted">{user.email}</p>
              ) : null}
            </div>
            <a
              href={chatHref}
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                window.location.assign(chatHref)
              }}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Back to chat
            </a>
            <MenuLink
              href={BEVEL_PRIVATE_PATH}
              icon={HomeIcon}
              onClick={() => setOpen(false)}
            >
              Private agents
            </MenuLink>
            <MenuLink
              href="/workspaces"
              icon={BuildingOffice2Icon}
              onClick={() => setOpen(false)}
            >
              Workspaces
            </MenuLink>
            <MenuLink
              href="/console/settings"
              icon={Cog6ToothIcon}
              onClick={() => setOpen(false)}
            >
              Settings
            </MenuLink>
            <MenuLink
              href="/account"
              icon={UserCircleIcon}
              onClick={() => setOpen(false)}
            >
              Platform profile
            </MenuLink>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-raised"
              onClick={() => {
                setOpen(false)
                void signOut({ callbackUrl: platformLoginUrl() })
              }}
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 text-muted" />
              Sign out
            </button>
            <div className="border-t border-border px-3 py-1.5">
              <Link
                href={platformPublicUrl()}
                className="text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                bevel.is
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string
  icon: typeof Cog6ToothIcon
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-muted" />
      {children}
    </Link>
  )
}
