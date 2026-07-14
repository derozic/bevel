'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { AnnouncementBar } from '@bevel/ui'
import {
  SOCIAL_NETWORKS,
  validateSocialUrl,
  type Announcement,
  type AnnouncementPlacement,
} from '@bevel/schema'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import { resolveDaypart } from '@/lib/daypart'
import { bannerStyleForDaypart } from '@/lib/daypart-banners'

const DISMISS_KEY = 'bevel.announcements.dismissed'

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_BEVEL_API_URL?.replace(/\/$/, '') ||
    'https://api.bevel.lvh.me'
  )
}

type NextStep = {
  title: string
  body: string
  linkLabel: string
  linkHref: string
  icon: string
}

/**
 * Pick the next onboarding action: profile first, then integrations.
 * Returns null when both look complete (bottom bar can hide).
 */
function resolveNextStep(input: {
  displayName?: string
  handle?: string
  bio?: string
  hasSocial?: boolean
  clickupConnected?: boolean
  attioConnected?: boolean
  githubLogin?: string | null
}): NextStep | null {
  const name = (input.displayName ?? '').trim()
  const handle = (input.handle ?? '').trim()
  const bio = (input.bio ?? '').trim()
  const profileThin = !name || !handle || name.length < 2

  if (profileThin) {
    return {
      title: 'Action may be required:',
      body: 'Add your display name and handle so teammates and agents know who you are in this workspace.',
      linkLabel: 'Complete profile',
      linkHref: '/settings?section=profile',
      icon: 'user-group',
    }
  }

  if (!bio) {
    return {
      title: 'Action may be required:',
      body: 'Write a short bio on your profile — it shows on your h-card and helps agents address you correctly.',
      linkLabel: 'Edit profile',
      linkHref: '/settings?section=profile',
      icon: 'user-group',
    }
  }

  if (!input.hasSocial) {
    return {
      title: 'Action may be required:',
      body: 'Link at least one social (X, Instagram, TikTok, or YouTube) with rel=me on your profile.',
      linkLabel: 'Add socials',
      linkHref: '/settings?section=profile',
      icon: 'link',
    }
  }

  if (!input.clickupConnected && !input.attioConnected) {
    return {
      title: 'Action may be required:',
      body: 'Connect ClickUp or Attio so agents can pull tasks and CRM context into the channel.',
      linkLabel: 'Connect integrations',
      linkHref: '/settings?section=integrations',
      icon: 'link',
    }
  }

  if (!input.githubLogin) {
    return {
      title: 'Action may be required:',
      body: 'Link GitHub for work mode — agents need write access to put tasks on the repo.',
      linkLabel: 'Open integrations',
      linkHref: '/settings?section=integrations',
      icon: 'link',
    }
  }

  return null
}

type Ctx = {
  items: Announcement[]
  dismissed: Set<string>
  onDismiss: (id: string) => void
  resolved: Announcement[]
}

const AnnouncementCtx = createContext<Ctx | null>(null)

function useAnnouncementCtx(): Ctx {
  const ctx = useContext(AnnouncementCtx)
  if (!ctx) {
    throw new Error('Announcement stack must be inside AnnouncementProvider')
  }
  return ctx
}

export function AnnouncementProvider({
  tenantSlug,
  children,
}: {
  tenantSlug?: string | null
  children: ReactNode
}) {
  const { data: session, status } = useSession()
  const prefs = usePreferencesOptional()
  const [items, setItems] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const slug = tenantSlug ?? session?.tenantSlug ?? null

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ active: 'true' })
    if (slug) params.set('tenant', slug)

    void (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/api/v1/announcements?${params.toString()}`,
          { credentials: 'omit', cache: 'no-store' },
        )
        if (!res.ok) return
        const data = (await res.json()) as { announcements?: Announcement[] }
        if (cancelled) return
        setItems(data.announcements ?? [])
      } catch {
        /* offline */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  const onDismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }, [])

  const profile = prefs?.prefs.profile
  const integrations = prefs?.prefs.integrations
  const socials = profile?.socials
  const hasSocial = SOCIAL_NETWORKS.some((id) =>
    validateSocialUrl(id, socials?.[id] ?? '').ok &&
      Boolean(socials?.[id]?.trim()),
  )

  const nextStep = useMemo(
    () =>
      resolveNextStep({
        displayName: profile?.displayName || session?.user?.name || '',
        handle: profile?.handle || '',
        bio: profile?.bio || '',
        hasSocial,
        clickupConnected: integrations?.clickup?.connected,
        attioConnected: integrations?.attio?.connected,
        githubLogin: session?.githubLogin,
      }),
    [
      profile?.displayName,
      profile?.handle,
      profile?.bio,
      hasSocial,
      integrations?.clickup?.connected,
      integrations?.attio?.connected,
      session?.user?.name,
      session?.githubLogin,
    ],
  )

  const resolved = useMemo(() => {
    return items
      .filter((a) => {
        if (dismissed.has(a.id)) return false
        if (a.audience === 'all') return true
        if (a.audience === 'authenticated') return status === 'authenticated'
        if (a.audience === 'operators') return status === 'authenticated'
        return true
      })
      .map((a) => {
        if (a.kind !== 'next_step') return a
        if (!nextStep) return null
        return {
          ...a,
          title: nextStep.title,
          body: nextStep.body,
          linkLabel: nextStep.linkLabel,
          linkHref: nextStep.linkHref,
          icon: nextStep.icon || a.icon,
          ctaVariant: a.ctaVariant ?? 'link',
          placement: (a.placement ?? 'bottom') as AnnouncementPlacement,
        } satisfies Announcement
      })
      .filter((a): a is Announcement => a != null)
      .sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0))
  }, [items, dismissed, status, nextStep])

  const value = useMemo(
    () => ({ items, dismissed, onDismiss, resolved }),
    [items, dismissed, onDismiss, resolved],
  )

  return (
    <AnnouncementCtx.Provider value={value}>{children}</AnnouncementCtx.Provider>
  )
}

export function AnnouncementStack({
  placement,
}: {
  placement: AnnouncementPlacement
}) {
  const { resolved, onDismiss } = useAnnouncementCtx()
  const prefs = usePreferencesOptional()
  const daypart = resolveDaypart(prefs?.prefs.appearance.daypart ?? 'auto')
  // Re-render when clock crosses day-part boundaries under Auto
  const [, setTick] = useState(0)
  useEffect(() => {
    if ((prefs?.prefs.appearance.daypart ?? 'auto') !== 'auto') return
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [prefs?.prefs.appearance.daypart])

  const visible = resolved.filter(
    (a) => (a.placement ?? 'top') === placement,
  )
  // One bar per placement — highest priority wins
  const bar = visible[0]
  if (!bar) return null

  // Top = promo atmosphere; bottom / next_step = action atmosphere
  const role =
    placement === 'bottom' || bar.kind === 'next_step' ? 'action' : 'promo'
  const daypartStyle = bannerStyleForDaypart(daypart, role)

  return (
    <div
      className={
        placement === 'bottom'
          ? 'bevel-announcement-stack bevel-announcement-stack--bottom'
          : 'bevel-announcement-stack bevel-announcement-stack--top'
      }
      data-placement={placement}
      data-daypart={daypart}
      data-banner-role={role}
    >
      <AnnouncementBar
        key={`${bar.id}-${daypart}-${role}`}
        title={bar.title || undefined}
        body={bar.body}
        icon={bar.icon || undefined}
        linkLabel={bar.linkLabel}
        linkHref={bar.linkHref}
        linkKind={bar.linkKind}
        ctaVariant={bar.ctaVariant ?? 'link'}
        dismissible={bar.dismissible}
        onDismiss={() => onDismiss(bar.id)}
        style={daypartStyle}
        tone={role}
      />
    </div>
  )
}

/** @deprecated use AnnouncementProvider + AnnouncementStack */
export function AnnouncementHost({
  tenantSlug,
}: {
  tenantSlug?: string | null
}) {
  return (
    <AnnouncementProvider tenantSlug={tenantSlug}>
      <AnnouncementStack placement="top" />
    </AnnouncementProvider>
  )
}
