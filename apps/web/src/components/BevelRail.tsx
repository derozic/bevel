'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookmarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import type { MouseEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { cn } from '@/lib/utils'
import { agents } from '@/lib/agent-catalog'
import {
  BEVEL_COPY,
  BEVEL_PRIVATE_PATH,
  BEVEL_TAGS_PATH,
  BEVEL_TRADEMARK_NOTICE,
  bevelChannelPath,
  bevelConversationPath,
  bevelTalkPath,
  channelTag,
  isRedundantChannelName,
  sortChannelsByEscalation,
} from '@/lib/bevel'
import { FeatureFlagsBar } from '@/components/FeatureFlagsBar'
import {
  filterVisibleSessions,
  readConversationCache,
  seedConversationCache,
  syncConversationData,
} from '@/lib/conversation-list'
import {
  hydrateChannelCacheFromStorage,
  seedChannelCache,
  syncChannelData,
} from '@/lib/channel-list'
import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'
import type { SessionSummary } from '@/lib/realtime'
import {
  pinKey,
  resolvePins,
  togglePin,
  type ConversationPin,
} from '@/lib/conversation-pins'
import {
  countUnreadTimeline,
  formatTimelineTeaser,
  latestConversationPreview,
  pickTimelineTeaser,
  type TimelineTeaserItem,
} from '@/lib/timeline-teaser'
import { BevelMark } from './BevelMark'
import { SuiteNav } from './SuiteNav'
import { WorkspaceBrand } from './WorkspaceBrand'
import { FolksonomyChips } from './FolksonomyChips'
import { ConversationRoster } from './ConversationRoster'
import { ConversationSearch } from './ConversationSearch'
import { CreateChannelModal } from './CreateChannelModal'
import { BrandSquare, BrandSquareGrid } from './BrandSquare'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'

function BevelRailFooter({
  plan,
  featureAccess,
  featureSet,
}: {
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Link
        href={BEVEL_TAGS_PATH}
        className="bevel-rail-footer-link inline-flex"
        title="Tags"
      >
        <TagIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Tags
      </Link>
      {plan || featureAccess || featureSet ? (
        <FeatureFlagsBar
          compact
          plan={plan}
          featureAccess={featureAccess}
          featureSet={featureSet}
          className="mt-1 border-t border-border/60 pt-2"
        />
      ) : null}
    </div>
  )
}

function conversationLabel(summary: SessionSummary): string {
  if (summary.title?.trim()) return summary.title
  const ids = summary.agentIds ?? []
  const names = ids.map((id) => agents.find((a) => a.id === id)?.name ?? id)
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  if (names.length > 2) return `${names[0]} +${names.length - 1}`
  return 'Conversation'
}

function pinHref(pin: ConversationPin): string {
  if (pin.kind === 'channel') return bevelChannelPath(pin.id)
  if (pin.kind === 'talk') return bevelTalkPath(pin.id)
  return bevelConversationPath({ sessionId: pin.id })
}

export function BevelRail({
  productName,
  platformHomeHref,
  platformHomeLabel,
  activeSlug,
  activeSessionId,
  initialChannels,
  initialSessions,
  plan,
  featureAccess,
  featureSet,
  onNavigate,
  headerAction,
  privateAgentsOnly = false,
}: {
  productName?: string
  platformHomeHref?: string
  platformHomeLabel?: string
  activeSlug?: string
  activeSessionId?: string
  initialChannels?: FleetChannelSummary[]
  initialSessions?: SessionSummary[]
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
  onNavigate?: () => void
  headerAction?: ReactNode
  /** Apex private: skip org channels (agents + DMs only) */
  privateAgentsOnly?: boolean
}) {
  const { status } = useSession()
  const pathname = usePathname()
  const prefs = usePreferencesOptional()
  const timelineActive =
    pathname === '/timeline' ||
    pathname === '/bevel/timeline' ||
    pathname?.startsWith('/timeline/') ||
    pathname?.startsWith('/bevel/timeline')
  const escalatedSet = useMemo(() => {
    const list = prefs?.prefs.home.escalatedChannels ?? []
    return new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean))
  }, [prefs?.prefs.home.escalatedChannels])
  const [propertiesSlug, setPropertiesSlug] = useState<string | null>(null)
  const [brandMarkUrl, setBrandMarkUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    const root = document.documentElement
    const read = () =>
      root.getAttribute('data-tenant-logo') ||
      getComputedStyle(root).getPropertyValue('--brand-icon-url').trim() ||
      undefined
    setBrandMarkUrl(read() || undefined)
  }, [])
  // SSR-safe initial state only — localStorage is applied in useEffect (React #418).
  const [channels, setChannels] = useState<FleetChannelSummary[]>(() => {
    if (privateAgentsOnly) return []
    return seedChannelCache(initialChannels ?? DEFAULT_CHANNELS)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [conversations, setConversations] = useState<SessionSummary[]>(() =>
    seedConversationCache(initialSessions ?? []),
  )
  const [conversationsLoading, setConversationsLoading] = useState(
    () => !(initialSessions?.length),
  )
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const conversationsFetchedRef = useRef(false)
  const channelsBootstrappedRef = useRef(false)
  const [timelineItems, setTimelineItems] = useState<TimelineTeaserItem[]>([])

  const initialChannelsKey = useMemo(
    () =>
      (initialChannels ?? [])
        .map((c) => `${c.slug}:${c.name}`)
        .join('|'),
    [initialChannels]
  )

  useEffect(() => {
    if (!initialChannels?.length) return
    setChannels((prev) => syncChannelData(prev, initialChannels))
  }, [initialChannelsKey, initialChannels])

  const initialSessionsKey = useMemo(
    () =>
      (initialSessions ?? [])
        .map((s) => `${s.sessionId}:${s.messageCount}:${s.preview ?? ''}`)
        .join('|'),
    [initialSessions]
  )

  useEffect(() => {
    if (!initialSessions?.length) return
    setConversations((prev) => syncConversationData(prev, initialSessions))
  }, [initialSessionsKey, initialSessions])

  const loadTimeline = useCallback(async () => {
    try {
      const res = await fetch('/api/timeline?limit=20', {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as { items?: TimelineTeaserItem[] }
      setTimelineItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* keep last teaser */
    }
  }, [])

  const loadConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setConversationsLoading(true)
    setConversationsError(null)
    try {
      const res = await fetch('/api/fleet/sessions', { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Could not load conversations (${res.status})`)
      }
      const data = (await res.json()) as { sessions?: SessionSummary[] }
      const list = filterVisibleSessions(data.sessions ?? [])
      setConversations((prev) => syncConversationData(prev, list))
    } catch (e) {
      setConversationsError(
        e instanceof Error ? e.message : 'Could not load conversations'
      )
    } finally {
      if (!opts?.silent) setConversationsLoading(false)
    }
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fleet/channels', { credentials: 'include' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          detail?: string
        }
        const message =
          body.error ??
          (typeof body.detail === 'string' ? body.detail : undefined) ??
          `Could not load channels (${res.status})`
        throw new Error(message)
      }
      const data = (await res.json()) as { channels?: FleetChannelSummary[] }
      const list = data.channels ?? []
      setChannels((prev) => syncChannelData(prev, list))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load channels')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  // After mount: merge localStorage + session order (never in useState — React #418)
  useEffect(() => {
    if (privateAgentsOnly) return
    setChannels(
      hydrateChannelCacheFromStorage(initialChannels ?? DEFAULT_CHANNELS),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once after mount
  }, [privateAgentsOnly])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      setLoading(false)
      setChannels(privateAgentsOnly ? [] : DEFAULT_CHANNELS)
      return
    }
    if (!channelsBootstrappedRef.current) {
      channelsBootstrappedRef.current = true
      if (!privateAgentsOnly) {
        void load({ silent: true })
      } else {
        setChannels([])
        setLoading(false)
      }
      if (!conversationsFetchedRef.current) {
        conversationsFetchedRef.current = true
        if (!initialSessions?.length) {
          void loadConversations({ silent: true })
        }
      }
      void loadTimeline()
    }
  }, [
    load,
    loadConversations,
    loadTimeline,
    status,
    initialSessions?.length,
    privateAgentsOnly,
  ])

  useEffect(() => {
    if (status !== 'authenticated') return
    void loadTimeline()
    const interval = window.setInterval(() => {
      void loadConversations({ silent: true })
      void loadTimeline()
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [loadConversations, loadTimeline, status])

  const visible = useMemo(
    () =>
      sortChannelsByEscalation(
        channels,
        prefs?.prefs.home.escalatedChannels ?? [],
      ),
    [channels, prefs?.prefs.home.escalatedChannels],
  )
  const visibleConversations = conversations.slice(0, 24)
  const propertiesChannel =
    visible.find((ch) => ch.slug === propertiesSlug) ?? null

  const toggleEscalated = useCallback(
    (slug: string) => {
      if (!prefs) return
      const key = slug.trim().toLowerCase()
      if (!key) return
      const current = prefs.prefs.home.escalatedChannels ?? []
      const next = current.some((s) => s.toLowerCase() === key)
        ? current.filter((s) => s.toLowerCase() !== key)
        : [...current, key]
      prefs.updatePrefs({ home: { escalatedChannels: next } })
    },
    [prefs],
  )

  const fallbackPinSlugs = useMemo(
    () => (privateAgentsOnly ? [] : visible.map((ch) => ch.slug)),
    [privateAgentsOnly, visible],
  )
  const { pins: pinned } = useMemo(
    () =>
      resolvePins(prefs?.prefs.home.pinnedConversations, fallbackPinSlugs),
    [prefs?.prefs.home.pinnedConversations, fallbackPinSlugs],
  )
  const pinnedKeys = useMemo(
    () => new Set(pinned.map((p) => `${p.kind}:${p.id}`)),
    [pinned],
  )

  const togglePinned = useCallback(
    (pin: ConversationPin) => {
      if (!prefs) return
      const current =
        prefs.prefs.home.pinnedConversations ??
        resolvePins(undefined, fallbackPinSlugs).pins
      prefs.updatePrefs({
        home: { pinnedConversations: togglePin(current, pin) },
      })
    },
    [prefs, fallbackPinSlugs],
  )

  const onChannelClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, slug: string) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        togglePinned({ kind: 'channel', id: slug })
        return
      }
      onNavigate?.()
    },
    [onNavigate, togglePinned],
  )

  const onPinClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, pin: ConversationPin) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        togglePinned(pin)
        return
      }
      onNavigate?.()
    },
    [onNavigate, togglePinned],
  )

  const unpinnedChannels = useMemo(
    () =>
      visible.filter(
        (ch) => !pinnedKeys.has(`channel:${ch.slug.toLowerCase()}`),
      ),
    [visible, pinnedKeys],
  )

  const feedTeaser = useMemo(
    () => pickTimelineTeaser(timelineItems),
    [timelineItems],
  )
  const feedUnread = useMemo(
    () => countUnreadTimeline(timelineItems),
    [timelineItems],
  )
  const feedPreview = useMemo(() => {
    if (feedTeaser) return formatTimelineTeaser(feedTeaser)
    return (
      latestConversationPreview(
        conversations.map((row) => ({
          title: conversationLabel(row),
          preview: row.preview,
          updatedAt: row.updatedAt,
        })),
      ) || BEVEL_COPY.feedEmpty
    )
  }, [feedTeaser, conversations])

  return (
    <div className="bevel-rail">
      <div className="bevel-rail-header">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <WorkspaceBrand productName={productName} />
            {platformHomeHref ? (
              <a
                href={platformHomeHref}
                className="bevel-rail-platform-back"
                title={`Back to ${platformHomeLabel || productName || 'home'}`}
              >
                ← {platformHomeLabel || productName || 'home'}
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Right-half suite chip → apex bevel.is */}
            <SuiteNav
              size="sm"
              showLabel={false}
              productLabel={productName}
            />
            {!privateAgentsOnly ? (
              <button
                type="button"
                onClick={() => {
                  setCreatedSlug(null)
                  setShowCreate(true)
                }}
                className="bevel-rail-new-channel"
              >
                {BEVEL_COPY.newChannel}
              </button>
            ) : null}
            {headerAction}
          </div>
        </div>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
          {privateAgentsOnly ? 'Private agents' : BEVEL_COPY.channelsLabel}
        </p>
        {status === 'authenticated' ? (
          <div className="mt-2">
            <ConversationSearch />
          </div>
        ) : null}
      </div>

      <div className="bevel-rail-nav">
        {privateAgentsOnly ? (
          <nav aria-label="Private home" className="mb-2">
            <Link
              href={BEVEL_PRIVATE_PATH}
              onClick={onNavigate}
              className="bevel-rail-channel"
              data-active={
                pathname === BEVEL_PRIVATE_PATH || pathname === '/bevel/me'
                  ? 'true'
                  : 'false'
              }
            >
              <span className="bevel-rail-channel-slug">me</span>
              <span className="bevel-rail-channel-name">Agents home</span>
            </Link>
          </nav>
        ) : null}
        <nav aria-label="Timeline" className="mb-2">
          <Link
            href="/timeline"
            onClick={onNavigate}
            className="bevel-rail-conversation bevel-rail-feed"
            data-active={timelineActive ? 'true' : 'false'}
            data-unread={feedUnread > 0 ? 'true' : 'false'}
            title={feedPreview}
          >
            <span className="bevel-rail-conversation-title flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {BEVEL_COPY.feedLabel}
              {feedUnread > 0 ? (
                <span className="bevel-rail-feed-count">{feedUnread}</span>
              ) : null}
            </span>
            <span className="bevel-rail-conversation-preview">{feedPreview}</span>
          </Link>
        </nav>
        <nav aria-label={BEVEL_COPY.pinnedLabel}>
          <p className="bevel-rail-section-label mb-1.5 px-1">
            {BEVEL_COPY.pinnedLabel}
          </p>
          {pinned.length === 0 ? (
            <p className="bevel-rail-empty px-1">{BEVEL_COPY.pinnedEmpty}</p>
          ) : (
            <BrandSquareGrid label={BEVEL_COPY.pinnedLabel}>
              {pinned.map((pin) => {
                const agent =
                  pin.kind === 'talk'
                    ? agents.find((a) => a.id === pin.id)
                    : undefined
                const session =
                  pin.kind === 'session'
                    ? conversations.find((c) => c.sessionId === pin.id)
                    : undefined
                const escalated =
                  pin.kind === 'channel' && escalatedSet.has(pin.id)
                const label =
                  pin.kind === 'talk'
                    ? agent?.name ?? pin.id
                    : pin.kind === 'session'
                      ? session
                        ? conversationLabel(session)
                        : pin.id.slice(0, 8)
                      : channelTag(pin.id, { escalated })
                const active =
                  pin.kind === 'channel'
                    ? activeSlug === pin.id
                    : pin.kind === 'talk'
                      ? Boolean(
                          activeSessionId &&
                            (activeSessionId === `talk:${pin.id}` ||
                              activeSessionId.endsWith(`-${pin.id}`)),
                        )
                      : activeSessionId === pin.id
                return (
                  <BrandSquare
                    key={pinKey(pin)}
                    href={pinHref(pin)}
                    label={label}
                    logoUrl={
                      pin.kind === 'talk'
                        ? agent?.avatarUrl
                        : pin.kind === 'channel'
                          ? brandMarkUrl
                          : undefined
                    }
                    processKey={pin.id}
                    active={active}
                    escalated={escalated}
                    busy={pin.kind === 'channel' ? loading : false}
                    onClick={(e) => onPinClick(e, pin)}
                    onContextMenu={
                      pin.kind === 'channel'
                        ? (e) => {
                            e.preventDefault()
                            setPropertiesSlug((s) =>
                              s === pin.id ? null : pin.id,
                            )
                          }
                        : undefined
                    }
                    title={`${label} — pin. Ctrl/Cmd+click to unpin.`}
                  />
                )
              })}
            </BrandSquareGrid>
          )}
        </nav>

        <nav aria-label={BEVEL_COPY.channelsLabel} className="mt-3">
          {privateAgentsOnly ? null : (
            <>
              {unpinnedChannels.length > 0 ? (
                <div className="mb-2">
                  {unpinnedChannels.map((ch) => {
                    const escalated = escalatedSet.has(ch.slug.toLowerCase())
                    const distinctName = !isRedundantChannelName(ch.slug, ch.name)
                    return (
                      <div key={ch.slug} className="bevel-rail-conversation-row">
                        <Link
                          href={bevelChannelPath(ch.slug)}
                          onClick={(e) => onChannelClick(e, ch.slug)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setPropertiesSlug((s) =>
                              s === ch.slug ? null : ch.slug,
                            )
                          }}
                          className="bevel-rail-channel"
                          data-active={activeSlug === ch.slug ? 'true' : 'false'}
                          data-escalated={escalated ? 'true' : 'false'}
                          title={channelTag(ch.slug, { escalated })}
                        >
                          <span className="bevel-rail-channel-slug">
                            {channelTag(ch.slug, { escalated })}
                          </span>
                          {distinctName ? (
                            <span className="bevel-rail-channel-name">{ch.name}</span>
                          ) : null}
                        </Link>
                        <button
                          type="button"
                          className="bevel-rail-pin-btn"
                          aria-label={`Pin ${channelTag(ch.slug)}`}
                          title="Pin"
                          onClick={() =>
                            togglePinned({ kind: 'channel', id: ch.slug })
                          }
                        >
                          <BookmarkIcon className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {propertiesChannel ? (
                <div
                  className="bevel-rail-channel-panel"
                  role="dialog"
                  aria-label={`${propertiesChannel.name || propertiesChannel.slug} properties`}
                >
                  <p className="bevel-rail-channel-panel-title">
                    {channelTag(propertiesChannel.slug, {
                      escalated: escalatedSet.has(
                        propertiesChannel.slug.toLowerCase(),
                      ),
                    })}{' '}
                    · properties
                  </p>
                  <p className="bevel-rail-channel-panel-hint">
                    Tracks show as ~slug. Escalated tracks pin to the top as
                    ^slug. Tags are folksonomy — anyone can add one.
                  </p>
                  <div className="mt-2 px-1">
                    <FolksonomyChips
                      kind="track"
                      id={propertiesChannel.slug}
                      initialTags={propertiesChannel.tags}
                    />
                  </div>
                  <p className="bevel-rail-channel-panel-hint mt-2">
                    Workflows land here via webhooks.{' '}
                    <a href="/console/workflows#webhooks" className="underline">
                      Mint an inbound URL
                    </a>{' '}
                    for ~{propertiesChannel.slug}.
                  </p>
                  <button
                    type="button"
                    className="bevel-rail-channel-panel-action"
                    data-escalated={
                      escalatedSet.has(propertiesChannel.slug.toLowerCase())
                        ? 'true'
                        : 'false'
                    }
                    onClick={() => {
                      toggleEscalated(propertiesChannel.slug)
                    }}
                  >
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    {escalatedSet.has(propertiesChannel.slug.toLowerCase())
                      ? 'Remove high priority'
                      : 'Escalate channel (^)'}
                  </button>
                  <p className="bevel-rail-channel-panel-meta">
                    Tip: Ctrl/Cmd+click the channel, or right-click for this
                    panel.
                  </p>
                  <button
                    type="button"
                    className="bevel-rail-channel-panel-close"
                    onClick={() => setPropertiesSlug(null)}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </>
          )}
        </nav>

        <div className="bevel-rail-section">
          <div className="bevel-rail-section-header">
            <p className="bevel-rail-section-label">{BEVEL_COPY.conversationsLabel}</p>
          </div>
          <div className="mb-2 px-1">
            <ConversationRoster onStarted={onNavigate} />
          </div>
          <nav aria-label={BEVEL_COPY.conversationsLabel}>
            {/* Always list fleet agents so a DM is one click away */}
            {agents.map((agent) => {
              const href = bevelTalkPath(agent.id)
              const live = visibleConversations.find((c) => {
                const ids = c.agentIds ?? []
                return (
                  ids.length === 1 &&
                  ids[0]?.toLowerCase() === agent.id.toLowerCase()
                )
              })
              const active =
                activeSessionId != null &&
                (activeSessionId === live?.sessionId ||
                  activeSessionId === `talk:${agent.id}` ||
                  activeSessionId.endsWith(`-${agent.id}`) ||
                  activeSessionId.includes(`-${agent.id}`) ||
                  activeSessionId.endsWith(`-${agent.id.toLowerCase()}`))
              const pin = { kind: 'talk' as const, id: agent.id }
              const isPinned = pinnedKeys.has(pinKey(pin))
              return (
                <div key={agent.id} className="bevel-rail-conversation-row">
                  <Link
                    href={href}
                    onClick={onNavigate}
                    data-active={active ? 'true' : 'false'}
                    className="bevel-rail-conversation"
                    title={`Message ${agent.name}`}
                  >
                    <span className="bevel-rail-conversation-title">
                      {agent.name}
                    </span>
                    <span className="bevel-rail-conversation-preview">
                      {live?.preview?.trim() ||
                        agent.tagline ||
                        agent.role ||
                        'Direct thread'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="bevel-rail-pin-btn"
                    data-pinned={isPinned ? 'true' : 'false'}
                    aria-label={isPinned ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
                    title={isPinned ? 'Unpin' : 'Pin'}
                    onClick={() => togglePinned(pin)}
                  >
                    <BookmarkIcon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )
            })}
            {/* Multi-agent or historical sessions not covered by single-agent rows */}
            {visibleConversations
              .filter((c) => (c.agentIds ?? []).length !== 1)
              .map((conv) => {
                const pin = { kind: 'session' as const, id: conv.sessionId }
                const isPinned = pinnedKeys.has(pinKey(pin))
                return (
                <div key={conv.sessionId} className="bevel-rail-conversation-row">
                <Link
                  href={bevelConversationPath(conv)}
                  onClick={onNavigate}
                  data-active={
                    activeSessionId === conv.sessionId ? 'true' : 'false'
                  }
                  className="bevel-rail-conversation"
                >
                  <span className="bevel-rail-conversation-title">
                    {conversationLabel(conv)}
                  </span>
                  <span className="bevel-rail-conversation-preview">
                    {conv.preview ??
                      ((conv.agentIds ?? []).length > 0
                        ? (conv.agentIds ?? [])
                            .map(
                              (id) =>
                                agents.find((a) => a.id === id)?.name ?? id,
                            )
                            .join(' · ')
                        : '\u00a0')}
                  </span>
                </Link>
                  <button
                    type="button"
                    className="bevel-rail-pin-btn"
                    data-pinned={isPinned ? 'true' : 'false'}
                    aria-label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                    title={isPinned ? 'Unpin' : 'Pin'}
                    onClick={() => togglePinned(pin)}
                  >
                    <BookmarkIcon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                )
              })}
            {conversationsLoading && visibleConversations.length === 0 ? (
              <p className="bevel-rail-empty" aria-busy>
                {BEVEL_COPY.loadingConversations}
              </p>
            ) : null}
          </nav>
          {conversationsError ? (
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="bevel-rail-retry"
            >
              Retry conversations
            </button>
          ) : null}
        </div>
      </div>

      {createdSlug || error ? (
      <div className="bevel-rail-notices" aria-live="polite">
        {createdSlug ? (
          <div className="bevel-rail-notice bevel-rail-notice--success">
            <p className="font-medium">
              Created{' '}
              <Link
                href={bevelChannelPath(createdSlug)}
                onClick={onNavigate}
                className="font-semibold underline"
              >
                ~{createdSlug}
              </Link>
              — open when you are ready.
            </p>
          </div>
        ) : (
          <div className="bevel-rail-notice bevel-rail-notice--error">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      ) : null}

      <div className="bevel-rail-footer">
        <BevelRailFooter
          plan={plan}
          featureAccess={featureAccess}
          featureSet={featureSet}
        />
      </div>

      <CreateChannelModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(channel) => {
          setShowCreate(false)
          setCreatedSlug(channel.slug)
          setChannels((prev) => syncChannelData(prev, [...prev, channel]))
          void load({ silent: true })
        }}
      />
    </div>
  )
}

/** @deprecated Use BevelRail inside BevelWorkspace */
export function ChannelSidebar({
  activeSlug,
  initialChannels,
  className,
}: {
  activeSlug: string
  initialChannels?: FleetChannelSummary[]
  className?: string
}) {
  return (
    <div className={cn(className)}>
      <BevelRail activeSlug={activeSlug} initialChannels={initialChannels} />
    </div>
  )
}

export type { FleetChannelSummary }