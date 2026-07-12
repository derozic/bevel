'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import {
  ArrowRightEndOnRectangleIcon,
  Cog6ToothIcon,
  IdentificationIcon,
  LinkIcon,
  PaintBrushIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import type { DaypartPreference } from '@bevel/schema'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  cn,
} from '@bevel/ui'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import {
  DAYPART_META,
  DAYPART_ORDER,
  resolveDaypart,
} from '@/lib/daypart'

function initials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

const SIZE = {
  sm: 'size-8 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
} as const

/**
 * Radix avatar dropdown — same pattern as 2x4m UserAvatarRadix.
 * Opens profile / preferences sections and supports day-part + sign out.
 */
export function UserMenu({
  className,
  size = 'sm',
  align = 'end',
}: {
  className?: string
  size?: keyof typeof SIZE
  align?: 'start' | 'center' | 'end'
}) {
  const { data: session, status } = useSession()
  const prefs = usePreferencesOptional()
  const user = session?.user
  const daypartPref = prefs?.prefs.appearance.daypart ?? 'auto'
  const resolvedDaypart = resolveDaypart(daypartPref)

  if (status === 'loading') {
    return (
      <div
        className={cn(
          'animate-pulse rounded-full bg-border/60',
          SIZE[size],
          className,
        )}
        aria-hidden
      />
    )
  }

  if (status !== 'authenticated' || !user) {
    return (
      <button
        type="button"
        onClick={() => void signIn('google')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-accent/10',
          className,
        )}
      >
        <ArrowRightEndOnRectangleIcon className="size-3.5" aria-hidden />
        Sign in
      </button>
    )
  }

  const name = user.name ?? 'Member'
  const email = user.email ?? ''
  const image = user.image ?? undefined
  const label = initials(name, email)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative z-10 inline-flex shrink-0 cursor-pointer rounded-full outline-none transition',
            'hover:ring-2 hover:ring-accent/40 hover:ring-offset-2 hover:ring-offset-[var(--cream,var(--bevel-bg,#fff))]',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            'data-[state=open]:ring-2 data-[state=open]:ring-accent/50',
            className,
          )}
          aria-label="Account menu"
          aria-haspopup="menu"
        >
          {/* pointer-events-none so the button always receives the click */}
          <Avatar className={cn(SIZE[size], 'pointer-events-none border-border')}>
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="bg-accent/15 font-semibold text-accent">
              {label}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="z-[200] w-60" sideOffset={8}>
        <div className="border-b border-border px-2.5 py-2.5 mb-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {email ? (
            <p className="mt-0.5 truncate text-xs text-muted">{email}</p>
          ) : null}
          {session.tenantSlug ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              {session.tenantSlug}
              {session.githubLogin ? ` · @${session.githubLogin}` : ''}
            </p>
          ) : null}
        </div>

        <DropdownMenuItem
          onSelect={() => prefs?.openSection('profile')}
        >
          <UserCircleIcon className="size-4 shrink-0 opacity-80" aria-hidden />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => prefs?.openSection('account')}>
          <IdentificationIcon className="size-4 shrink-0 opacity-80" aria-hidden />
          Account
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => prefs?.openSection('ai')}>
          <Cog6ToothIcon className="size-4 shrink-0 opacity-80" aria-hidden />
          Preferences
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => prefs?.openSection('appearance')}>
          <PaintBrushIcon className="size-4 shrink-0 opacity-80" aria-hidden />
          Appearance
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => prefs?.openSection('integrations')}>
          <LinkIcon className="size-4 shrink-0 opacity-80" aria-hidden />
          Integrations
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunIcon className="size-4 shrink-0 opacity-80" aria-hidden />
            Day part
            <span className="ml-auto text-[10px] text-muted">
              {daypartPref === 'auto'
                ? `Auto · ${DAYPART_META[resolvedDaypart].shortLabel}`
                : DAYPART_META[resolvedDaypart].shortLabel}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel>Atmosphere</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={daypartPref}
              onValueChange={(v) =>
                prefs?.updatePrefs({
                  appearance: { daypart: v as DaypartPreference },
                })
              }
            >
              <DropdownMenuRadioItem value="auto">
                Auto
                <span className="ml-auto text-[10px] text-muted">
                  {DAYPART_META[resolvedDaypart].shortLabel}
                </span>
              </DropdownMenuRadioItem>
              {DAYPART_ORDER.map((id) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {DAYPART_META[id].label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          destructive
          onSelect={() => void signOut({ callbackUrl: '/' })}
        >
          <ArrowRightEndOnRectangleIcon
            className="size-4 shrink-0 opacity-80"
            aria-hidden
          />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
