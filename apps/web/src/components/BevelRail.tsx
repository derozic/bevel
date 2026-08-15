'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftIcon,
  ClockIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
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
import { BevelMark } from './BevelMark'
import { SuiteNav } from './SuiteNav'
import { WorkspaceBrand } from './WorkspaceBrand'
import { FolksonomyChips } from './FolksonomyChips'
import { ConversationRoster } from './ConversationRoster'
import { ConversationSearch } from './ConversationSearch'
import { CreateChannelModal } from './CreateChannelModal'
import { DaypartControl } from './DaypartControl'
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
  const prefs = usePreferencesOptional()
  return (
    <div className="flex flex-col gap-1.5">
      <DaypartControl />
      <button
        type="button"
        className="bevel-rail-footer-link w-full text-left"
        onClick={() => prefs?.openSection('appearance')}
      >
        <Cog6ToothIcon className="h-3.5 w-3.5" />
        Appearance
      </button>
      <button
        type="button"
        className="bevel-rail-footer-link w-full text-left"
        onClick={() => prefs?.openSection('ai')}
      >
        <Cog6ToothIcon className="h-3.5 w-3.5" />
        Preferences
      </button>
      <Link href={BEVEL_TAGS_PATH} className="bevel-rail-footer-link">
        Tags
      </Link>
      <Link href="/" className="bevel-rail-footer-link">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Home
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
    }
  }, [
    load,
    loadConversations,
    status,
    initialSessions?.length,
    privateAgentsOnly,
  ])

  useEffect(() => {
    if (status !== 'authenticated') return
    const interval = window.setInterval(() => {
      void loadConversations({ silent: true })
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [loadConversations, status])

  const visible = useMemo(
    () =>
      sortChannelsByEscalation(
        channels,
        prefs?.prefs.home.escalatedChannels ?? [],
      ),
    [channels, prefs?.prefs.home.escalatedChannels],
  )
  const visibleConversations = conversations.slice(0, 24)

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

  const onChannelClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, slug: string) => {
      // Ctrl/Cmd+click toggles high-priority (^) without navigating
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        toggleEscalated(slug)
        return
      }
      onNavigate?.()
    },
    [onNavigate, toggleEscalated],
  )

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
            className="bevel-rail-channel"
            data-active={timelineActive ? 'true' : 'false'}
          >
            <span className="bevel-rail-channel-slug flex items-center gap-1">
              <ClockIcon className="h-3 w-3" aria-hidden />
              feed
            </span>
            <span className="bevel-rail-channel-name">Timeline</span>
          </Link>
        </nav>
        <nav aria-label={BEVEL_COPY.channelsLabel}>
          {privateAgentsOnly
            ? null
            : visible.map((ch) => {
            const escalated = escalatedSet.has(ch.slug.toLowerCase())
            const propsOpen = propertiesSlug === ch.slug
            return (
              <div key={ch.slug} className="bevel-rail-channel-wrap">
                <Link
                  href={bevelChannelPath(ch.slug)}
                  onClick={(e) => onChannelClick(e, ch.slug)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setPropertiesSlug((s) => (s === ch.slug ? null : ch.slug))
                  }}
                  data-active={activeSlug === ch.slug ? 'true' : 'false'}
                  data-escalated={escalated ? 'true' : 'false'}
                  className="bevel-rail-channel"
                  aria-busy={loading ? true : undefined}
                  title={
                    escalated
                      ? `${channelTag(ch.slug, { escalated: true })} — high priority. Ctrl/Cmd+click to remove.`
                      : `${channelTag(ch.slug)} — Ctrl/Cmd+click to escalate (^)`
                  }
                >
                  <span className="bevel-rail-channel-slug">
                    {channelTag(ch.slug, { escalated })}
                  </span>
                  <span className="bevel-rail-channel-name">
                    {ch.name || '\u00a0'}
                  </span>
                  {ch.tags?.length ? (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {ch.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-black/5 px-1.5 text-[9px] font-medium uppercase tracking-wide text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  className="bevel-rail-channel-props"
                  aria-label={`Channel properties for ${ch.slug}`}
                  aria-expanded={propsOpen}
                  title="Channel properties"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setPropertiesSlug((s) => (s === ch.slug ? null : ch.slug))
                  }}
                >
                  <Cog6ToothIcon className="h-3 w-3" />
                </button>
                {propsOpen ? (
                  <div
                    className="bevel-rail-channel-panel"
                    role="dialog"
                    aria-label={`${ch.name || ch.slug} properties`}
                  >
                    <p className="bevel-rail-channel-panel-title">
                      {channelTag(ch.slug, { escalated })} · properties
                    </p>
                    <p className="bevel-rail-channel-panel-hint">
                      Tracks show as ~slug. Escalated tracks pin to the top as
                      ^slug. Tags are folksonomy — anyone can add one.
                    </p>
                    <div className="mt-2 px-1">
                      <FolksonomyChips
                        kind="track"
                        id={ch.slug}
                        initialTags={ch.tags}
                      />
                    </div>
                    <p className="bevel-rail-channel-panel-hint mt-2">
                      Workflows land here via webhooks.{' '}
                      <a href="/console/workflows#webhooks" className="underline">
                        Mint an inbound URL
                      </a>{' '}
                      for ~{ch.slug}.
                    </p>
                    <button
                      type="button"
                      className="bevel-rail-channel-panel-action"
                      data-escalated={escalated ? 'true' : 'false'}
                      onClick={() => {
                        toggleEscalated(ch.slug)
                      }}
                    >
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                      {escalated
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
              </div>
            )
          })}
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
              return (
                <Link
                  key={agent.id}
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
              )
            })}
            {/* Multi-agent or historical sessions not covered by single-agent rows */}
            {visibleConversations
              .filter((c) => (c.agentIds ?? []).length !== 1)
              .map((conv) => (
                <Link
                  key={conv.sessionId}
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
              ))}
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
        ) : error ? (
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
        ) : (
          <span className="bevel-rail-notices-placeholder" aria-hidden />
        )}
      </div>

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