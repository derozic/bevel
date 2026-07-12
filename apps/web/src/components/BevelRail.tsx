'use client'

import Link from 'next/link'
import { ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
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
  BEVEL_TRADEMARK_NOTICE,
  bevelChannelPath,
  bevelConversationPath,
  bevelTalkPath,
} from '@/lib/bevel'
import { FeatureFlagsBar } from '@/components/FeatureFlagsBar'
import {
  filterVisibleSessions,
  readConversationCache,
  seedConversationCache,
  syncConversationData,
} from '@/lib/conversation-list'
import {
  readChannelCache,
  seedChannelCache,
  syncChannelData,
} from '@/lib/channel-list'
import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'
import type { SessionSummary } from '@/lib/realtime'
import { BevelMark } from './BevelMark'
import { WorkspaceBrand } from './WorkspaceBrand'
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
  const names = summary.agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? id)
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
}) {
  const { status } = useSession()
  const [channels, setChannels] = useState<FleetChannelSummary[]>(() => {
    const cached = readChannelCache()
    if (cached.length > 0) {
      return syncChannelData(cached, initialChannels ?? DEFAULT_CHANNELS)
    }
    return seedChannelCache(initialChannels ?? DEFAULT_CHANNELS)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [conversations, setConversations] = useState<SessionSummary[]>(() => {
    const cached = readConversationCache()
    if (cached.length > 0) {
      return syncConversationData(cached, initialSessions ?? [])
    }
    return seedConversationCache(initialSessions ?? [])
  })
  const [conversationsLoading, setConversationsLoading] = useState(
    () => readConversationCache().length === 0 && !(initialSessions?.length)
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

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      setLoading(false)
      setChannels(DEFAULT_CHANNELS)
      return
    }
    if (!channelsBootstrappedRef.current) {
      channelsBootstrappedRef.current = true
      void load({ silent: true })
      if (!conversationsFetchedRef.current) {
        conversationsFetchedRef.current = true
        if (!initialSessions?.length) {
          void loadConversations({ silent: true })
        }
      }
    }
  }, [load, loadConversations, status, initialSessions?.length])

  useEffect(() => {
    if (status !== 'authenticated') return
    const interval = window.setInterval(() => {
      void loadConversations({ silent: true })
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [loadConversations, status])

  const visible = channels
  const visibleConversations = conversations.slice(0, 24)

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
            {headerAction}
          </div>
        </div>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
          {BEVEL_COPY.channelsLabel}
        </p>
        {status === 'authenticated' ? (
          <div className="mt-2">
            <ConversationSearch />
          </div>
        ) : null}
      </div>

      <div className="bevel-rail-nav">
        <nav aria-label={BEVEL_COPY.channelsLabel}>
          {visible.map((ch) => (
            <Link
              key={ch.slug}
              href={bevelChannelPath(ch.slug)}
              onClick={onNavigate}
              data-active={activeSlug === ch.slug ? 'true' : 'false'}
              className="bevel-rail-channel"
              aria-busy={loading ? true : undefined}
            >
              <span className="bevel-rail-channel-slug">^{ch.slug}</span>
              <span className="bevel-rail-channel-name">{ch.name || '\u00a0'}</span>
            </Link>
          ))}
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
              const live = visibleConversations.find(
                (c) =>
                  c.agentIds.length === 1 &&
                  c.agentIds[0]?.toLowerCase() === agent.id.toLowerCase(),
              )
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
              .filter((c) => c.agentIds.length !== 1)
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
                      (conv.agentIds.length > 0
                        ? conv.agentIds
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
                ^{createdSlug}
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