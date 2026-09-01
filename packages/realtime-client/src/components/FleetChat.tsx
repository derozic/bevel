'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Client, getStateCallbacks, type Room } from '@colyseus/sdk'
import {
  Bars3Icon,
  PaperAirplaneIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useFleet } from '../FleetProvider'
import { accentStripeColor } from '../lib/accent'
import {
  dedupeHumanParticipantsByUser,
  dedupeMessagesById,
  isValidSchemaMessage,
  readHumanParticipants,
  readSchemaMessages,
  toChatMsg,
  type ChatMsg,
  type HumanParticipant,
  type SchemaMessage,
} from '../lib/colyseus-messages'
import { ChatMessageBody } from '../lib/chat-markdown'
import {
  MAX_CHAT_IMAGES,
  chatImageMarkdown,
  collectImageFiles,
  hasChatImageMarkdown,
  isAllowedChatImageFile,
} from '../lib/chat-images'
import {
  applyMention,
  filterMixedMentionCandidates,
  mentionDraftAt,
  mentionedAgentIds,
  type MentionCandidate,
  type PersonCandidate,
} from '../lib/mentions'
import { formatSpeaker } from '../lib/system-voice'
import { readRoomSnapshot, writeRoomSnapshot } from '../lib/room-state-cache'
import {
  formatFleetError,
  formatRoomErrorEvent,
  sanitizeErrorText,
} from '../lib/format-error'
import { pinRealtimeEndpoint } from '../lib/realtime-client'
import { cn } from '../lib/utils'
import {
  BEVEL_COPY,
  isSeatReservationExpired,
  resolveBevelConnectionIssue,
  type BevelConnectionIssue,
} from '../product/bevel-copy'
import { channelTag } from '../product/bevel'
import type { FleetAgent } from '../types'
import { AgentChip } from './AgentChip'
import { HumanAvatar } from './HumanAvatar'
import { BevelPoweredBy } from './BevelPoweredBy'
import {
  GestureBurstMark,
  GestureThumbTray,
  MessageGestures,
  displayMessageBody,
  optimisticGesture,
} from './MessageGestures'
import { useBubbleGestures } from '../lib/bubble-gestures'
import type { GestureKind } from '@bevel/schema'

const SEAT_RETRY_MAX = 5
const SEAT_RETRY_DELAY_MS = 900

function jwtStillValid(token?: string): boolean {
  if (!token) return false
  try {
    const part = token.split('.')[1]
    if (!part) return false
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now() + 8_000
  } catch {
    return true
  }
}

function isTransientJoinFailure(msg: string): boolean {
  return (
    isSeatReservationExpired(msg) ||
    /1006|abnormal close|timed out|timeout|connection lost|websocket/i.test(msg)
  )
}

type PendingChatImage = {
  id: string
  file: File
  previewUrl: string
}

async function uploadChatImage(file: File): Promise<{ url: string; name: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/chat/images', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = (await res.json().catch(() => null)) as
    | { url?: string; name?: string; error?: string }
    | null
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Could not upload image (${res.status})`)
  }
  return { url: data.url, name: data.name || file.name || 'image' }
}

/** Known leftover portraits still served even if they left the registry. */
const LEGACY_AGENT_AVATARS: Record<string, string> = {
  terry: '/avatars/terry.svg',
  forge: '/avatars/forge.svg',
}

/**
 * Prefer catalog avatar URL; ignore non-URL icon tokens (e.g. "cpu-chip").
 * Fall back to known public portraits by agent id / name.
 */
function resolveAgentAvatarSrc(
  agent: FleetAgent | undefined,
  agentId?: string,
  speaker?: string,
): string | undefined {
  const raw = agent?.avatar?.trim()
  if (raw && (raw.startsWith('/') || raw.startsWith('http') || raw.endsWith('.svg') || raw.endsWith('.png') || raw.endsWith('.jpg') || raw.endsWith('.webp'))) {
    return raw
  }
  const key = (agent?.id || agentId || speaker || '').trim().toLowerCase()
  if (key && LEGACY_AGENT_AVATARS[key]) return LEGACY_AGENT_AVATARS[key]
  if (key && /^[a-z][a-z0-9-]*$/.test(key)) return `/avatars/${key}.svg`
  return undefined
}

/** Never surface Colyseus "error undefined" placeholders in the UI. */
function safeIssue(issue: BevelConnectionIssue): BevelConnectionIssue {
  const title = sanitizeErrorText(issue.title)
  if (
    !title ||
    title === 'undefined' ||
    /^error\s+undefined$/i.test(title)
  ) {
    return {
      title: BEVEL_COPY.errors.connectionFailed,
      hint: sanitizeErrorText(issue.hint) || BEVEL_COPY.errors.connectionHint,
    }
  }
  return {
    title,
    hint: sanitizeErrorText(issue.hint) || undefined,
  }
}

/** Pinned inside the shell so connection issues stay visible above the thread. */
function ConnectionNotice({
  issue,
  tone = 'info',
}: {
  issue: BevelConnectionIssue
  tone?: 'info' | 'warn'
}) {
  const safe = safeIssue(issue)
  return (
    <div
      className="fleet-chat-notice"
      data-tone={tone}
      role={tone === 'warn' ? 'alert' : 'status'}
    >
      <p className="fleet-chat-notice-line">
        <span className="fleet-chat-notice-title">{safe.title}</span>
        {safe.hint ? (
          <span className="fleet-chat-notice-hint">{safe.hint}</span>
        ) : null}
      </p>
      <button
        type="button"
        className="fleet-chat-notice-retry"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  )
}

function scheduleSeatRetry(
  cancelled: () => boolean,
  bumpAttempt: () => void
): void {
  window.setTimeout(() => {
    if (!cancelled()) bumpAttempt()
  }, SEAT_RETRY_DELAY_MS)
}

export type FleetChatProps = {
  /**
   * Optional people directory for @ / ^ autocomplete.
   * Prefer live lookup via peopleLookupPath when available.
   */
  people?: PersonCandidate[]
  /**
   * GET path that returns `{ users: [{ handle, name, imageUrl }] }`.
   * Queried while typing @ or ^ (e.g. `/api/users/lookup`).
   */
  peopleLookupPath?: string
  /** When true, channel header shows `^slug` (high priority) instead of `~slug`. */
  channelEscalated?: boolean
  initialAgents?: string[]
  agents?: FleetAgent[]
  className?: string
  /** Fill parent flex column (workspace / full-viewport mode). */
  fillViewport?: boolean
  showChannelToggle?: boolean
  onChannelToggle?: () => void
  /** Bookmark jump target from conversation search */
  focusMessageId?: string
  /** Query string for in-thread highlight */
  highlightQuery?: string
  /**
   * Optional account control (e.g. Radix avatar dropdown) rendered in the
   * chat header trailing slot — same surface as 2x4m UserAvatarRadix.
   */
  userMenu?: ReactNode
  /**
   * Build a direct-message href for an agent (e.g. /brain/chat).
   * When provided, agent chips expose a Message action on their profile card.
   */
  agentMessageHref?: (agentId: string) => string
  /** Show speaker avatars in the thread (default true). */
  showAvatars?: boolean
  /** Name label style from preferences. */
  nameStyle?: 'full_and_display' | 'display_only'
  /** Prefer 24-hour timestamps when true. */
  clock24h?: boolean
  /**
   * Fired when an agent program-style message lands (e.g. JOHNNY Caddy heal).
   * Host app raises PWA / desktop / Flutter notifications.
   */
  onProgramMessage?: (event: {
    id: string
    agentId?: string
    speaker: string
    body: string
  }) => void
}

/** Hide legacy join/leave/welcome noise still in live room state. */
function isEphemeralChannelNoise(body: string): boolean {
  return (
    /joined ♡|stepped out|i'm derozic|your fleet's listening|welcome in/i.test(body) ||
    /joined [#^]|left [#^]/i.test(body) ||
    /^[#^]\w+ · (roster:|.* is on the roster)/i.test(body)
  )
}

function visibleMessages(messages: ChatMsg[]): ChatMsg[] {
  return dedupeMessagesById(messages).filter(
    (m) => m.speakerType !== 'system' || !isEphemeralChannelNoise(m.body)
  )
}

function sameAgentRoster(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const norm = (ids: string[]) =>
    [...ids].map((id) => id.toLowerCase()).sort().join('\0')
  return norm(a) === norm(b)
}

function sameParticipants(a: HumanParticipant[], b: HumanParticipant[]): boolean {
  if (a.length !== b.length) return false
  const key = (list: HumanParticipant[]) =>
    list
      .map((p) => `${p.userId}:${p.clientId}`)
      .sort()
      .join('\0')
  return key(a) === key(b)
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
  if (terms.length === 0) return <>{text}</>
  try {
    const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    const parts = text.split(re)
    return (
      <>
        {parts.map((part, i) =>
          terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
            <mark key={i} className="fleet-chat-mark">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    )
  } catch {
    return <>{text}</>
  }
}

function formatMessageName(
  speaker: string,
  nameStyle: 'full_and_display' | 'display_only',
  agent?: FleetAgent,
): string {
  if (agent) {
    if (nameStyle === 'full_and_display') {
      return `${agent.name} · @${agent.id}`
    }
    return agent.name
  }
  const label = typeof speaker === 'string' ? speaker : ''
  // Humans: speaker is already the display string from the room
  if (nameStyle === 'display_only') {
    const first = label.trim().split(/\s+/)[0]
    return first || label
  }
  return label
}

function GestureBubble({
  enabled,
  burst,
  className,
  style,
  children,
  onToggle,
  onOpenDock,
}: {
  enabled: boolean
  burst?: GestureKind | null
  className: string
  style?: CSSProperties
  children: ReactNode
  onToggle?: (kind: GestureKind) => void
  onOpenDock?: () => void
}) {
  const handlers = useBubbleGestures({
    enabled: enabled && Boolean(onToggle),
    onGesture: (kind) => onToggle?.(kind),
    onOpenDock: () => onOpenDock?.(),
    openDockOnTap: true,
  })
  return (
    <div
      className={className}
      style={style}
      data-burst={burst || undefined}
      data-burst-kind={burst || undefined}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onContextMenu={handlers.onContextMenu}
    >
      {children}
      {burst ? <GestureBurstMark kind={burst} /> : null}
    </div>
  )
}

function MessageRow({
  m,
  agents,
  selfName,
  selfId,
  focused,
  highlightQuery,
  showAvatars = true,
  nameStyle = 'full_and_display',
  onGesture,
  dockOpen,
  burst,
  onOpenDock,
  onCloseDock,
}: {
  m: ChatMsg
  agents: FleetAgent[]
  selfName: string
  selfId: string
  focused?: boolean
  highlightQuery?: string
  showAvatars?: boolean
  nameStyle?: 'full_and_display' | 'display_only'
  onGesture?: (messageId: string, kind: GestureKind) => void
  dockOpen?: boolean
  burst?: GestureKind | null
  onOpenDock?: () => void
  onCloseDock?: () => void
}) {
  const rowProps = {
    id: `msg-${m.id}`,
    'data-message-id': m.id,
    'data-focused': focused ? 'true' : undefined,
    'data-reacting': dockOpen ? 'true' : undefined,
    'data-avatars': showAvatars ? 'true' : 'false',
  } as const

  if (m.speakerType === 'system') {
    if (isEphemeralChannelNoise(m.body)) return null
    return (
      <div className="fleet-chat-msg-row fleet-chat-msg-row--system" {...rowProps}>
        <div
          className="fleet-chat-msg-system"
          data-pending={m.status === 'pending' ? 'true' : undefined}
        >
          <HighlightedText text={m.body} query={highlightQuery} />
        </div>
      </div>
    )
  }

  if (m.speakerType === 'human') {
    const isSelf =
      (selfId && m.speakerId && m.speakerId === selfId) || m.speaker === selfName
    const label = formatMessageName(m.speaker, nameStyle)
    const bodyText = displayMessageBody(m)
    return (
      <div className="fleet-chat-msg-row fleet-chat-msg-row--human" {...rowProps}>
        {showAvatars ? (
          <HumanAvatar name={m.speaker} avatarUrl={m.speakerAvatar} size="md" />
        ) : (
          <span className="fleet-chat-avatar-spacer" aria-hidden />
        )}
        <div className="fleet-chat-msg-stack">
          <GestureBubble
            enabled={!isSelf}
            burst={!isSelf ? burst : null}
            className="fleet-chat-bubble fleet-chat-bubble--human"
            onToggle={onGesture ? (kind) => onGesture(m.id, kind) : undefined}
            onOpenDock={onOpenDock}
          >
            {!isSelf ? (
              <p className="fleet-chat-msg-label">{label}</p>
            ) : null}
            <div className="fleet-chat-msg-body">
              {highlightQuery?.trim() ? (
                <p className="whitespace-pre-wrap">
                  <HighlightedText text={bodyText} query={highlightQuery} />
                </p>
              ) : (
                <ChatMessageBody text={bodyText} />
              )}
            </div>
          </GestureBubble>
          {onGesture ? (
            <MessageGestures
              message={m}
              selfId={selfId}
              incoming={!isSelf}
              dockOpen={dockOpen && !isSelf}
              onToggle={(kind) => onGesture(m.id, kind)}
              onCloseDock={onCloseDock}
            />
          ) : null}
        </div>
      </div>
    )
  }

  const agent = agents.find((a) => a.id === m.agentId)
  const accent = accentStripeColor(agent?.accent) ?? agent?.accent
  const agentLabel = formatMessageName(
    m.speaker,
    nameStyle,
    agent,
  )

  const agentAvatarSrc = resolveAgentAvatarSrc(agent, m.agentId, m.speaker)
  const bodyText = displayMessageBody(m)

  return (
    <div className="fleet-chat-msg-row fleet-chat-msg-row--agent" {...rowProps}>
      {showAvatars ? (
        agentAvatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agentAvatarSrc} alt="" className="fleet-chat-avatar" />
        ) : (
          <span
            className="fleet-chat-avatar-fallback"
            data-agent="true"
            style={
              accent
                ? ({ '--msg-accent': accent, backgroundColor: accent } as CSSProperties)
                : { backgroundColor: '#7c3aed' }
            }
          >
            {(m.speaker || 'A').slice(0, 2).toUpperCase()}
          </span>
        )
      ) : (
        <span className="fleet-chat-avatar-spacer" aria-hidden />
      )}
      <div className="fleet-chat-msg-stack">
        <GestureBubble
          enabled
          burst={burst}
          className="fleet-chat-bubble fleet-chat-bubble--agent"
          style={accent ? ({ '--msg-accent': accent } as CSSProperties) : undefined}
          onToggle={onGesture ? (kind) => onGesture(m.id, kind) : undefined}
          onOpenDock={onOpenDock}
        >
          <p className="fleet-chat-msg-label">{agentLabel}</p>
          <div className="fleet-chat-msg-body">
            {highlightQuery?.trim() ? (
              <p className="whitespace-pre-wrap">
                <HighlightedText text={bodyText} query={highlightQuery} />
              </p>
            ) : (
              <ChatMessageBody text={bodyText} />
            )}
          </div>
        </GestureBubble>
        {onGesture ? (
          <MessageGestures
            message={m}
            selfId={selfId}
            incoming
            dockOpen={dockOpen}
            onToggle={(kind) => onGesture(m.id, kind)}
            onCloseDock={onCloseDock}
          />
        ) : null}
      </div>
    </div>
  )
}

export function FleetChat({
  initialAgents = ['hermes', 'johnny'],
  agents: agentsProp,
  people: peopleProp,
  peopleLookupPath,
  channelEscalated = false,
  className,
  fillViewport = false,
  showChannelToggle = false,
  onChannelToggle,
  focusMessageId,
  highlightQuery,
  userMenu,
  agentMessageHref,
  showAvatars = true,
  nameStyle = 'full_and_display',
  clock24h = false,
  onProgramMessage,
}: FleetChatProps) {
  const fleet = useFleet()
  const displayName = fleet.displayName
  const selfId = fleet.userId ?? displayName
  const realtimeToken = fleet.realtimeToken
  const catalog = useMemo(() => {
    const list = agentsProp ?? fleet.agents
    const byId = new Map<string, (typeof list)[number]>()
    for (const agent of list) {
      byId.set(agent.id, agent)
    }
    return [...byId.values()]
  }, [agentsProp, fleet.agents])
  const isChannel = fleet.roomMode === 'channel'
  const channelSlug = fleet.channelSlug ?? 'general'
  const resumeSessionId = fleet.sessionId
  const newSessionTitle = fleet.sessionTitle
  const tenantSlug = fleet.tenantSlug || 'platform'
  const roomKey = isChannel
    ? `channel:${tenantSlug}:${channelSlug}`
    : `session:${resumeSessionId ?? 'new'}`
  const bootSnapshot = readRoomSnapshot(roomKey)
  const bootHasThread = Boolean(
    bootSnapshot?.messages.some((m) => m.speakerType !== 'system')
  )

  const [gestureDockId, setGestureDockId] = useState<string | null>(null)
  const [gestureBurst, setGestureBurst] = useState<{
    id: string
    kind: GestureKind
  } | null>(null)
  const [connected, setConnected] = useState(false)
  const [uiLive, setUiLive] = useState(bootHasThread)
  const [messages, setMessages] = useState<ChatMsg[]>(() => bootSnapshot?.messages ?? [])
  /** Older pages exist beyond the shared Colyseus room window. */
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyCursor, setHistoryCursor] = useState<{
    before: string | null
    beforeId: string | null
  }>({ before: null, beforeId: null })
  const [historyLoading, setHistoryLoading] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const notifiedProgramIds = useRef<Set<string>>(new Set())
  const [participants, setParticipants] = useState<HumanParticipant[]>(
    () => bootSnapshot?.participants ?? []
  )
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([])
  const [attachBusy, setAttachBusy] = useState(false)
  const [dropping, setDropping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [agentIds, setAgentIds] = useState<string[]>(() =>
    bootSnapshot?.agentIds?.length ? bootSnapshot.agentIds : initialAgents
  )
  const joinRosterRef = useRef(initialAgents)
  const displayNameRef = useRef(displayName)
  const sessionTitleRef = useRef(newSessionTitle)
  const tokenRef = useRef(realtimeToken)
  displayNameRef.current = displayName
  sessionTitleRef.current = newSessionTitle
  // Latch the last good token — a brief session blip must not tear down the room.
  // Drop an expired JWT so we do not keep matchmaking with a dead seat.
  if (realtimeToken && jwtStillValid(realtimeToken)) tokenRef.current = realtimeToken
  else if (tokenRef.current && !jwtStillValid(tokenRef.current)) {
    tokenRef.current = jwtStillValid(realtimeToken) ? realtimeToken : undefined
  }
  const [sessionId, setSessionId] = useState<string | null>(() => bootSnapshot?.sessionId ?? null)
  const [sessionTitle, setSessionTitle] = useState<string | null>(
    () => bootSnapshot?.sessionTitle ?? null
  )
  const [issue, setIssue] = useState<BevelConnectionIssue | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [workMode, setWorkMode] = useState(false)
  const [ticketMode, setTicketMode] = useState(false)
  const [ticketBusy, setTicketBusy] = useState(false)
  const writableRepos = (fleet.workRepos ?? []).filter((r) => r.canWrite)
  const activeWorkRepo =
    fleet.selectedWorkRepo ??
    writableRepos.find((r) => r.default)?.fullName ??
    writableRepos[0]?.fullName ??
    fleet.workRepo ??
    'derozic/2x4m'
  const roomRef = useRef<Room | null>(null)
  const joinedRoomKeyRef = useRef<string | null>(null)
  const priorRoomKeyRef = useRef<string | undefined>(undefined)
  const connectGenRef = useRef(0)
  const tokenReady = Boolean(tokenRef.current)
  // People currently in the room. When a userMenu (account avatar) is mounted,
  // drop the current user from presence so we do not show two identical faces —
  // the account control is the single self avatar and is the one that opens.
  const presenceRoster = useMemo(() => {
    const all = dedupeHumanParticipantsByUser(participants)
    if (!userMenu) return all
    const selfId = fleet.userId?.trim()
    const selfName = fleet.displayName?.trim().toLowerCase()
    const selfAvatar = fleet.avatarUrl?.trim()
    return all.filter((p) => {
      if (selfId && p.userId?.trim() === selfId) return false
      if (selfAvatar && p.avatar?.trim() === selfAvatar) return false
      // Fallback when presence userId is empty but name matches the operator
      if (selfName && p.name?.trim().toLowerCase() === selfName) return false
      return true
    })
  }, [participants, userMenu, fleet.userId, fleet.displayName, fleet.avatarUrl])
  const threadMessages = useMemo(() => dedupeMessagesById(messages), [messages])

  const initialAgentsKey = initialAgents.join(',')
  useEffect(() => {
    joinRosterRef.current = initialAgents
    setAgentIds((prev) => (sameAgentRoster(prev, initialAgents) ? prev : initialAgents))
  }, [initialAgentsKey])

  useEffect(() => {
    setConnectionAttempt(0)
  }, [roomKey])

  useEffect(() => {
    if (!fleet.authReady || tokenReady) return
    setIssue({
      title: fleet.authError ?? BEVEL_COPY.auth.joinRequired,
    })
  }, [fleet.authReady, fleet.authError, tokenReady])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    if (focusMessageId) return
    el.scrollTop = el.scrollHeight
  }, [roomKey, focusMessageId])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    if (focusMessageId) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 96 && distanceFromBottom > 1) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, focusMessageId])

  // Bookmark jump from conversation search → exact message + pulse
  useEffect(() => {
    if (!focusMessageId) return
    const el = threadRef.current
    if (!el) return
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const tryScroll = () => {
      const node = el.querySelector(
        `[data-message-id="${CSS.escape(focusMessageId)}"]`,
      ) as HTMLElement | null
      if (node) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' })
        node.setAttribute('data-focused', 'true')
        // Prefer in-message mark if highlight query present
        const mark = node.querySelector('mark.fleet-chat-mark') as HTMLElement | null
        if (mark) {
          mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        window.setTimeout(() => node.setAttribute('data-focused', 'settled'), 2200)
        return
      }
      attempts += 1
      if (attempts < 40) timer = setTimeout(tryScroll, 100)
    }
    timer = setTimeout(tryScroll, 50)
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [focusMessageId, highlightQuery, messages.length])

  // Publish loaded messages to the host tab for free local search (no network)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('bevel:room-messages', {
        detail: {
          roomKey,
          channelSlug,
          isChannel,
          sessionId: isChannel ? channelSlug : resumeSessionId || roomKey,
          messages: messages.map((m) => ({
            id: m.id,
            speaker: m.speaker,
            body: m.body,
            ts: m.ts,
            speakerType: m.speakerType,
          })),
        },
      }),
    )
  }, [messages, roomKey, channelSlug, isChannel, resumeSessionId])

  useEffect(() => {
    if (connected) {
      setUiLive(true)
      return
    }
    const timer = window.setTimeout(() => setUiLive(false), 400)
    return () => window.clearTimeout(timer)
  }, [connected])

  useEffect(() => {
    if (!tokenReady) return
    // Wait for the workspace slug so we do not matchmake as "platform" and
    // immediately tear the seat down when session/html hydrates to 2x4m.
    if (isChannel && !fleet.tenantSlug) return

    const gen = ++connectGenRef.current
    let cancelled = false
    const previousRoomKey = priorRoomKeyRef.current
    const switchingRoom = previousRoomKey !== undefined && previousRoomKey !== roomKey
    priorRoomKeyRef.current = roomKey

    if (switchingRoom && previousRoomKey) {
      writeRoomSnapshot(previousRoomKey, {
        messages,
        participants,
        sessionTitle,
        sessionId,
        agentIds,
      })
    }

    const cached = readRoomSnapshot(roomKey)
    if (switchingRoom) {
      setConnected(false)
      setUiLive(Boolean(cached?.messages.some((m) => m.speakerType !== 'system')))
      setMessages(cached?.messages ?? [])
      setParticipants(cached?.participants ?? [])
      setSessionTitle(cached?.sessionTitle ?? null)
      setSessionId(cached?.sessionId ?? null)
      if (cached?.agentIds?.length) {
        setAgentIds(cached.agentIds)
      }
      setHistoryHasMore(false)
      setHistoryCursor({ before: null, beforeId: null })
      setHistoryLoading(false)
      joinedRoomKeyRef.current = null
    }
    setIssue(null)

    const realtimeUrl = fleet.realtimeUrl
    const authToken = tokenRef.current ?? realtimeToken!
    // credentials:omit avoids cookie CORS traps (auth cookie domain .lvh.me is
    // sent to realtime.* with credentials:include). Auth is Bearer JWT only.
    const client = new Client(realtimeUrl, {
      fetchFn: (input, init) =>
        fetch(input, {
          ...init,
          credentials: 'omit',
        }),
      urlBuilder: (url) => pinRealtimeEndpoint(realtimeUrl, url),
    })
    client.auth.token = authToken

    const roomName = isChannel ? 'fleet_channel' : 'agent_session'
    const joinRoster = joinRosterRef.current
    const joinDisplayName = displayNameRef.current
    const joinTitle =
      sessionTitleRef.current ??
      `${joinDisplayName} · ${joinRoster.join(', ')}`

    if (joinRoster.length === 0) {
      setIssue({ title: 'Pick at least one agent to start.' })
      return
    }

    const joinOptions = isChannel
      ? {
          channelSlug,
          tenantSlug,
          agentIds: joinRoster,
          displayName: joinDisplayName,
          authToken,
        }
      : {
          ...(resumeSessionId ? { sessionId: resumeSessionId } : {}),
          agentIds: joinRoster,
          displayName: joinDisplayName,
          title: joinTitle,
          authToken,
        }

    const connectTimeout = window.setTimeout(() => {
      if (!cancelled && !roomRef.current) {
        if (connectionAttempt < SEAT_RETRY_MAX) {
          setIssue({ title: BEVEL_COPY.errors.seatReservationRetry })
          scheduleSeatRetry(() => cancelled, () => setConnectionAttempt((n) => n + 1))
          return
        }
        setIssue(
          resolveBevelConnectionIssue('connection timed out', {
            isChannel,
            realtimeUrl,
          })
        )
        setConnected(false)
      }
    }, 20_000)

    // React Strict Mode mounts, unmounts, remounts. Delay matchmake so the
    // first pass never reserves a seat that the cleanup immediately drops.
    const joinDelay = window.setTimeout(() => {
      if (cancelled || connectGenRef.current !== gen) return
      client
        .joinOrCreate(roomName, joinOptions)
        .then((room) => {
        window.clearTimeout(connectTimeout)
        if (cancelled || connectGenRef.current !== gen) {
          room.leave()
          return
        }

        try {
          roomRef.current = room
          joinedRoomKeyRef.current = roomKey
          setConnected(true)
          setIssue(null)
          setSessionId(room.roomId)

          type RoomState = {
            sessionId?: string
            channelSlug?: string
            title?: string
            poweredByLabel?: string
            agentIds?: { length: number; [index: number]: string }
            messages?: { length: number; [index: number]: Parameters<typeof toChatMsg>[0] }
            humans?: { length: number; [index: number]: HumanParticipant }
          }

          const bindState = (state: RoomState) => {
            if (state.channelSlug) {
              setSessionId((prev) => (prev === state.channelSlug ? prev : state.channelSlug!))
            } else if (state.sessionId) {
              setSessionId((prev) => (prev === state.sessionId ? prev : state.sessionId!))
            }
            if (state.title) {
              setSessionTitle((prev) => (prev === state.title ? prev : state.title!))
            }
            if (!isChannel && state.agentIds && state.agentIds.length > 0) {
              const ids = Array.from({ length: state.agentIds.length }, (_, i) =>
                state.agentIds![i].toLowerCase()
              )
              setAgentIds((prev) => (sameAgentRoster(prev, ids) ? prev : ids))
            }
            const nextParticipants = readHumanParticipants(state.humans)
            setParticipants((prev) =>
              sameParticipants(prev, nextParticipants) ? prev : nextParticipants
            )
          }

          bindState(room.state as RoomState)

          const $ = getStateCallbacks(room)

          const upsertMessage = (msg: SchemaMessage) => {
            if (!isValidSchemaMessage(msg)) return
            const next = toChatMsg(msg)
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === next.id)
              const withoutLocal =
                next.speakerType === 'human'
                  ? prev.filter(
                      (m) =>
                        !(
                          m.id.startsWith('local_') &&
                          m.body === next.body &&
                          m.speakerType === 'human'
                        ),
                    )
                  : prev
              const merged =
                idx === -1
                  ? [...withoutLocal, next]
                  : withoutLocal.map((m) => (m.id === next.id ? next : m))
              return dedupeMessagesById(merged)
            })
          }

          /** Per-item listeners — array onChange can fire with undefined on delete. */
          const bindMessage = (msg: SchemaMessage) => {
            if (!isValidSchemaMessage(msg)) return
            upsertMessage(msg)
            $(msg).listen('body', () => upsertMessage(msg))
            $(msg).listen('status', () => upsertMessage(msg))
          }

          const roomMessages = (room.state as RoomState).messages
          if (roomMessages) {
            setMessages(readSchemaMessages(roomMessages))
            for (let i = 0; i < roomMessages.length; i++) {
              bindMessage(roomMessages[i])
            }
          }

          $(room.state).messages.onAdd((msg: SchemaMessage) => {
            bindMessage(msg)
          })
          $(room.state).messages.onRemove((msg: SchemaMessage) => {
            if (!isValidSchemaMessage(msg)) return
            setMessages((prev) => prev.filter((m) => m.id !== msg.id))
          })

          const syncParticipants = () => {
            const next = readHumanParticipants((room.state as RoomState).humans)
            setParticipants((prev) =>
              sameParticipants(prev, next) ? prev : next
            )
          }

          const humansRef = (room.state as RoomState).humans
          if (humansRef) {
            $(room.state).humans.onAdd(syncParticipants)
            $(room.state).humans.onRemove(syncParticipants)
          }

          room.onStateChange((state) => {
            bindState(state as RoomState)
            const synced = readSchemaMessages((state as RoomState).messages)
            if (synced.length > 0) {
              setMessages((prev) => {
                // Same snapshot — keep prev so we do not re-render / re-scroll
                // (iPad Safari treats scrollTop writes as a viewport resize).
                if (prev.length >= synced.length) return prev
                return dedupeMessagesById([...prev, ...synced])
              })
            }
          })

          room.onError((code, message) => {
            if (cancelled) return
            // Colyseus often fires onError(undefined, undefined) when the WS
            // ErrorEvent has no code/reason — never surface "error undefined".
            const raw = formatRoomErrorEvent(code, message)
            if (isSeatReservationExpired(raw) && connectionAttempt < SEAT_RETRY_MAX) {
              setIssue({ title: BEVEL_COPY.errors.seatReservationRetry })
              setConnected(false)
              scheduleSeatRetry(() => cancelled, () =>
                setConnectionAttempt((n) => n + 1)
              )
              return
            }
            setIssue(resolveBevelConnectionIssue(raw, { isChannel, realtimeUrl }))
            setConnected(false)
          })

          room.onMessage(
            'history_meta',
            (meta: {
              hasMore?: boolean
              nextBefore?: string | null
              nextBeforeId?: string | null
            }) => {
              if (cancelled) return
              setHistoryHasMore(Boolean(meta.hasMore))
              setHistoryCursor({
                before: meta.nextBefore ?? null,
                beforeId: meta.nextBeforeId ?? null,
              })
            },
          )

          room.onMessage(
            'history',
            (page: {
              messages?: Array<SchemaMessage>
              hasMore?: boolean
              nextBefore?: string | null
              nextBeforeId?: string | null
            }) => {
              if (cancelled) return
              setHistoryLoading(false)
              setHistoryHasMore(Boolean(page.hasMore))
              setHistoryCursor({
                before: page.nextBefore ?? null,
                beforeId: page.nextBeforeId ?? null,
              })
              const older = (page.messages ?? []).map((m) => toChatMsg(m))
              if (older.length === 0) return
              const el = threadRef.current
              const prevHeight = el?.scrollHeight ?? 0
              const prevTop = el?.scrollTop ?? 0
              setMessages((prev) => dedupeMessagesById([...older, ...prev]))
              // Keep viewport anchored when prepending older history.
              requestAnimationFrame(() => {
                const node = threadRef.current
                if (!node) return
                node.scrollTop = node.scrollHeight - prevHeight + prevTop
              })
            },
          )

          room.onLeave(() => {
            if (cancelled || connectGenRef.current !== gen) return
            if (joinedRoomKeyRef.current === roomKey) {
              joinedRoomKeyRef.current = null
            }
            setConnected(false)
          })
        } catch (e) {
          setIssue({
            title: BEVEL_COPY.errors.bindFailed,
            hint: formatFleetError(e) || undefined,
          })
          setConnected(false)
        }
      })
      .catch((e) => {
        window.clearTimeout(connectTimeout)
        if (cancelled) return
        const msg =
          formatFleetError(e) || BEVEL_COPY.errors.connectionFailed
        if (isTransientJoinFailure(msg) && connectionAttempt < SEAT_RETRY_MAX) {
          setIssue({ title: BEVEL_COPY.errors.seatReservationRetry })
          scheduleSeatRetry(() => cancelled, () => setConnectionAttempt((n) => n + 1))
          return
        }
        setIssue(resolveBevelConnectionIssue(msg, { isChannel, realtimeUrl }))
      })
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(joinDelay)
      window.clearTimeout(connectTimeout)
      if (connectGenRef.current === gen) {
        roomRef.current?.leave()
        roomRef.current = null
      }
    }
  }, [roomKey, connectionAttempt, fleet.realtimeUrl, isChannel, tokenReady, tenantSlug, fleet.tenantSlug])

  useEffect(() => {
    writeRoomSnapshot(roomKey, {
      messages,
      participants,
      sessionTitle,
      sessionId,
      agentIds,
    })
  }, [roomKey, messages, participants, sessionTitle, sessionId, agentIds])

  // Surface agent program runs (JOHNNY, etc.) to host notification bridges
  useEffect(() => {
    if (!onProgramMessage) return
    for (const m of messages) {
      if (m.speakerType !== 'agent' && m.speakerType !== 'system') continue
      if (m.status === 'pending') continue
      if (notifiedProgramIds.current.has(m.id)) continue
      const isProgram =
        m.agentId === 'johnny' ||
        /\[program:|^JOHNNY\b|program:/i.test(m.body)
      if (!isProgram) continue
      notifiedProgramIds.current.add(m.id)
      onProgramMessage({
        id: m.id,
        agentId: m.agentId,
        speaker: m.speaker,
        body: m.body,
      })
    }
  }, [messages, onProgramMessage])

  function mentionedAgents(text: string): string[] {
    const found = mentionedAgentIds(text, catalog)
    if (found.length > 0) return found
    return agentIds.length > 0 ? agentIds : catalog.map((a) => a.id).slice(0, 1)
  }

  const liveMentions = useMemo(
    () => mentionedAgentIds(input, catalog),
    [input, catalog],
  )
  const mentionDraft = useMemo(
    () => mentionDraftAt(input, caret),
    [input, caret],
  )
  const [lookupPeople, setLookupPeople] = useState<PersonCandidate[]>([])
  const peopleDirectory = peopleProp ?? lookupPeople

  // Live people lookup while typing @ or ^
  useEffect(() => {
    if (!mentionDraft || !peopleLookupPath) return
    const q = mentionDraft.query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const url = `${peopleLookupPath}${peopleLookupPath.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}&limit=12`
      fetch(url, { credentials: 'include', signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { users?: Array<{ handle?: string; name?: string; imageUrl?: string | null }> } | null) => {
          const users = data?.users ?? []
          setLookupPeople(
            users
              .filter((u) => u.handle)
              .map((u) => ({
                handle: String(u.handle).toLowerCase(),
                name: u.name,
                imageUrl: u.imageUrl,
              })),
          )
        })
        .catch(() => {
          /* offline — keep static peopleProp */
        })
    }, 120)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [mentionDraft, peopleLookupPath])

  const mentionCandidates: MentionCandidate[] = useMemo(() => {
    if (!mentionDraft) return []
    return filterMixedMentionCandidates(
      mentionDraft.kind,
      catalog,
      peopleDirectory,
      mentionDraft.query,
    )
  }, [catalog, mentionDraft, peopleDirectory])

  // When @agent resolves, light them up on the roster and auto-include
  useEffect(() => {
    if (liveMentions.length === 0) return
    setAgentIds((prev) => {
      const next = [...prev]
      let changed = false
      for (const id of liveMentions) {
        if (!next.some((x) => x.toLowerCase() === id)) {
          next.push(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [liveMentions])

  function insertMentionCandidate(pick: MentionCandidate) {
    if (!mentionDraft) return
    const token =
      pick.type === 'agent' ? pick.agent.id : pick.person.handle
    const kind =
      pick.type === 'person' && pick.escalate
        ? 'escalation'
        : mentionDraft.kind === 'escalation'
          ? 'escalation'
          : 'mention'
    const { text, caret: nextCaret } = applyMention(
      input,
      mentionDraft,
      token,
      kind,
    )
    setInput(text)
    setCaret(nextCaret)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function addImageFiles(files: File[]) {
    if (files.length === 0) return
    setPendingImages((prev) => {
      const room = Math.max(0, MAX_CHAT_IMAGES - prev.length)
      const next = files.filter(isAllowedChatImageFile).slice(0, room)
      if (next.length === 0) return prev
      return [
        ...prev,
        ...next.map((file) => ({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]
    })
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      const hit = prev.find((p) => p.id === id)
      if (hit) URL.revokeObjectURL(hit.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function handleClipboardPaste(event: React.ClipboardEvent) {
    const files = collectImageFiles(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    addImageFiles(files)
  }

  useEffect(() => {
    return () => {
      pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
    // revoke leftovers on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send() {
    const text = input.trim()
    if ((!text && pendingImages.length === 0) || !roomRef.current || ticketBusy) {
      return
    }

    let message = text
    const work = workMode && fleet.canPutOnWork && Boolean(activeWorkRepo)

    if (work && ticketMode && fleet.ticketApiPath) {
      setTicketBusy(true)
      try {
        const res = await fetch(fleet.ticketApiPath, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: text,
            channel: channelSlug,
            agents: mentionedAgents(text),
            repo: activeWorkRepo,
          }),
        })
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
        if (res.ok && data?.url) {
          message = `${text}\n\nTicket: ${data.url}`
        } else {
          setIssue({
            title: BEVEL_COPY.work.ticketFailed,
            hint: data?.error ?? `HTTP ${res.status}`,
          })
        }
      } catch {
        setIssue({ title: BEVEL_COPY.work.ticketFailed })
      } finally {
        setTicketBusy(false)
      }
    }

    const queued = pendingImages
    if (queued.length > 0) {
      setAttachBusy(true)
      try {
        const uploaded = await Promise.all(
          queued.map((item) => uploadChatImage(item.file)),
        )
        const imageMd = uploaded
          .map((item) => chatImageMarkdown(item.name, item.url))
          .join('\n')
        message = [message, imageMd].filter(Boolean).join('\n\n')
      } catch (err) {
        setIssue({
          title: 'Could not attach image',
          hint: err instanceof Error ? err.message : undefined,
        })
        setAttachBusy(false)
        return
      }
      queued.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      setPendingImages([])
      setAttachBusy(false)
    }

    if (!message.trim()) return
    if (!connected || !roomRef.current) {
      setIssue({
        title: "Couldn't send — not connected.",
        hint: BEVEL_COPY.errors.connectionHint,
      })
      return
    }

    const directTarget =
      !isChannel && agentIds.length === 1 ? agentIds[0] : undefined

    const optimistic: ChatMsg = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      speaker: displayName,
      speakerId: fleet.userId,
      speakerAvatar: fleet.avatarUrl,
      speakerType: 'human',
      body: message,
      status: 'final',
      ts: Date.now(),
    }
    setMessages((prev) => dedupeMessagesById([...prev, optimistic]))
    setInput('')
    setCaret(0)

    roomRef.current.send('chat', {
      text: message,
      speaker: displayName,
      agentIds,
      ...(directTarget ? { targetAgent: directTarget } : {}),
      work,
      workRepo: work ? activeWorkRepo : undefined,
    })
  }

  function sendGesture(messageId: string, kind: GestureKind) {
    const room = roomRef.current
    if (!room || !connected) return
    setMessages((prev) =>
      prev.map((row) =>
        row.id === messageId
          ? optimisticGesture(row, kind, selfId, displayName)
          : row,
      ),
    )
    setGestureBurst({ id: messageId, kind })
    window.setTimeout(() => {
      setGestureBurst((cur) => (cur?.id === messageId ? null : cur))
    }, 760)
    room.send('gesture', { messageId, kind })
  }

  const loadEarlierHistory = () => {
    if (!isChannel || !connected || historyLoading || !historyHasMore) return
    if (!historyCursor.before) return
    const room = roomRef.current
    if (!room) return
    setHistoryLoading(true)
    room.send('load_history', {
      before: historyCursor.before,
      beforeId: historyCursor.beforeId ?? undefined,
      limit: 50,
    })
  }

  const sessionsPath = fleet.sessionsPath
  const headerLabel = isChannel
    ? channelTag(channelSlug, { escalated: channelEscalated })
    : sessionTitle ?? (sessionId ? `Session ${sessionId.slice(0, 8)}…` : BEVEL_COPY.connectingSession)

  const visible = visibleMessages(messages)
  const hasThread = messages.some((m) => m.speakerType !== 'system')
  const live = connected || hasThread || uiLive
  const connectingLabel = isChannel
    ? BEVEL_COPY.connectingChannel(channelSlug)
    : BEVEL_COPY.connectingSession
  const statusLabel = headerLabel
  const showConnectingNotice = !connected && !issue && tokenReady

  const sampleAgent = agentIds[0] ?? catalog[0]?.id
  const sessionAgentNames = agentIds
    .map((id) => catalog.find((a) => a.id === id)?.name ?? id)
    .filter(Boolean)
  const emptySessionLabel = isChannel
    ? BEVEL_COPY.emptyChannel(channelSlug)
    : agentIds.length === 1 && sessionAgentNames[0]
      ? BEVEL_COPY.emptyDirectSession(sessionAgentNames[0]!)
      : agentIds.length > 1
        ? BEVEL_COPY.emptySessionMulti(sessionAgentNames)
        : BEVEL_COPY.emptySession
  const sessionPlaceholder =
    agentIds.length === 1 && sessionAgentNames[0]
      ? BEVEL_COPY.placeholderDirectSession(sessionAgentNames[0]!)
      : BEVEL_COPY.placeholderSession
  const dockedMessage =
    gestureDockId != null
      ? messages.find((m) => m.id === gestureDockId) ?? null
      : null

  return (
    <div
      className={cn('fleet-chat', fillViewport && 'fleet-chat--fill', className)}
    >
      <div className="fleet-chat-shell">
        <div className="fleet-chat-header">
          {showChannelToggle && onChannelToggle ? (
            <button
              type="button"
              className="fleet-chat-channels-btn"
              aria-label="Open channels"
              onClick={onChannelToggle}
            >
              <Bars3Icon className="h-4 w-4" />
            </button>
          ) : null}
          <span className="fleet-chat-header-title">
            <span className="fleet-chat-live-dot" data-live={live ? 'true' : 'false'} aria-hidden />
            {statusLabel}
          </span>
          <span className="fleet-chat-replay-slot">
            {!isChannel && connected && sessionId ? (
              <a href={`${sessionsPath}/${sessionId}`} className="fleet-chat-link">
                Replay
              </a>
            ) : (
              <span className="fleet-chat-link fleet-chat-link--ghost" aria-hidden>
                Replay
              </span>
            )}
          </span>
          <a href={sessionsPath} className="fleet-chat-link">
            {BEVEL_COPY.archiveNav}
          </a>
          <div className="fleet-chat-presence-slot" aria-label="People here">
            {presenceRoster.length > 0 ? (
              <div className="fleet-chat-presence">
                {presenceRoster.map((p, index) => (
                  <HumanAvatar
                    key={`${p.userId || 'anon'}:${p.clientId || index}`}
                    name={p.name}
                    avatarUrl={p.avatar}
                    size="sm"
                  />
                ))}
              </div>
            ) : userMenu ? null : (
              <span className="fleet-chat-presence-placeholder" aria-hidden />
            )}
          </div>
          {userMenu ? (
            <div className="fleet-chat-user-menu" data-account-menu>
              {userMenu}
            </div>
          ) : null}
        </div>

        <div className="fleet-chat-agents" role="group" aria-label="Agents in channel">
          {catalog.map((a) => {
            const isMentioned = liveMentions.includes(a.id.toLowerCase())
            return (
              <AgentChip
                key={a.id}
                agent={a}
                active={agentIds.some((id) => id.toLowerCase() === a.id.toLowerCase())}
                mentioned={isMentioned}
                messageHref={agentMessageHref?.(a.id)}
                role={a.category}
                onToggle={() => {
                  setAgentIds((prev) =>
                    prev.some((id) => id.toLowerCase() === a.id.toLowerCase())
                      ? prev.filter((x) => x.toLowerCase() !== a.id.toLowerCase())
                      : [...prev, a.id],
                  )
                }}
              />
            )
          })}
        </div>

        {/* Live @mentions — avatars brought forward so you know the agent resolved */}
        {liveMentions.length > 0 ? (
          <div
            className="fleet-chat-mention-strip"
            role="status"
            aria-live="polite"
            aria-label="Mentioned agents"
          >
            {liveMentions.map((id) => {
              const agent = catalog.find((a) => a.id.toLowerCase() === id)
              if (!agent) return null
              const stripe = accentStripeColor(agent.accent)
              return (
                <div
                  key={id}
                  className="fleet-chat-mention-pill"
                  data-mentioned="true"
                  style={
                    stripe
                      ? ({ '--chip-accent': stripe } as CSSProperties)
                      : undefined
                  }
                >
                  {agent.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent.avatar}
                      alt=""
                      className="fleet-chat-mention-pill-avatar"
                    />
                  ) : (
                    <span
                      className="fleet-chat-mention-pill-avatar fleet-chat-mention-pill-avatar--fallback"
                      aria-hidden
                    >
                      {agent.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="fleet-chat-mention-pill-copy">
                    <span className="fleet-chat-mention-pill-at">@{agent.id}</span>
                    <span className="fleet-chat-mention-pill-name">
                      {agent.name}
                      {agent.tagline ? ` · ${agent.tagline}` : ''}
                    </span>
                  </span>
                  <span className="fleet-chat-mention-pill-badge">Found</span>
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="fleet-chat-notice-slot" aria-live="polite">
          {issue ? (
            <ConnectionNotice
              issue={issue}
              tone={/sign in/i.test(issue.title) ? 'warn' : 'info'}
            />
          ) : showConnectingNotice ? (
            <div className="fleet-chat-notice" data-tone="info">
              <p className="fleet-chat-notice-line">
                <span className="fleet-chat-notice-title">{connectingLabel}</span>
              </p>
            </div>
          ) : (
            <span className="fleet-chat-notice-placeholder" aria-hidden />
          )}
        </div>

        <div
          ref={threadRef}
          className="fleet-chat-thread"
          onPointerDownCapture={(e) => {
            if (!gestureDockId) return
            const target = e.target as HTMLElement | null
            if (
              target?.closest(
                '.fleet-chat-gesture-dock, .fleet-chat-gestures, .fleet-chat-thumb-tray',
              )
            ) {
              return
            }
            setGestureDockId(null)
          }}
        >
          {isChannel && connected && (historyHasMore || historyLoading) ? (
            <div className="fleet-chat-history-bar">
              <button
                type="button"
                className="fleet-chat-history-btn"
                onClick={loadEarlierHistory}
                disabled={historyLoading || !historyHasMore}
              >
                {historyLoading
                  ? BEVEL_COPY.loadingEarlier
                  : BEVEL_COPY.loadEarlier}
              </button>
            </div>
          ) : null}
          {isChannel && connected && !historyHasMore && threadMessages.length > 0 ? (
            <p className="fleet-chat-history-end">{BEVEL_COPY.historyCaughtUp}</p>
          ) : null}
          {visible.length === 0 && connected && !issue && (
            <div className="fleet-chat-empty">
              <span className="fleet-chat-empty-emoji" aria-hidden>
                {BEVEL_COPY.emptyEmoji}
              </span>
              {emptySessionLabel}
            </div>
          )}
          {threadMessages.map((m) => (
            <MessageRow
              key={`${m.id}:${m.ts}`}
              m={m}
              agents={catalog}
              selfName={displayName}
              selfId={selfId}
              focused={focusMessageId === m.id}
              highlightQuery={highlightQuery}
              showAvatars={showAvatars}
              nameStyle={nameStyle}
              onGesture={connected ? sendGesture : undefined}
              dockOpen={gestureDockId === m.id}
              burst={gestureBurst?.id === m.id ? gestureBurst.kind : null}
              onOpenDock={() => setGestureDockId(m.id)}
              onCloseDock={() => setGestureDockId(null)}
            />
          ))}
        </div>

        {dockedMessage ? (
          <GestureThumbTray
            message={dockedMessage}
            selfId={selfId}
            speaker={
              catalog.find((a) => a.id === dockedMessage.agentId)?.name ||
              dockedMessage.speaker ||
              'this message'
            }
            burst={
              gestureBurst?.id === dockedMessage.id ? gestureBurst.kind : null
            }
            onToggle={(kind) => sendGesture(dockedMessage.id, kind)}
            onClose={() => setGestureDockId(null)}
          />
        ) : null}

        {fleet.githubAuthEnabled && !fleet.canPutOnWork ? (
          <div className="fleet-chat-work-hint">
            <p>{BEVEL_COPY.work.linkGitHubHint(fleet.workRepo ?? 'derozic/2x4m')}</p>
            {fleet.onLinkGitHub ? (
              <button type="button" className="fleet-chat-work-link" onClick={fleet.onLinkGitHub}>
                {BEVEL_COPY.work.linkGitHub}
              </button>
            ) : null}
          </div>
        ) : null}

        {workMode && fleet.canPutOnWork && writableRepos.length > 0 ? (
          <div className="fleet-chat-work-bar">
            <label className="fleet-chat-work-repo-label" htmlFor="fleet-work-repo">
              {BEVEL_COPY.work.pickRepo}
            </label>
            <select
              id="fleet-work-repo"
              className="fleet-chat-work-repo"
              value={activeWorkRepo}
              onChange={(e) => fleet.onWorkRepoChange?.(e.target.value)}
            >
              {writableRepos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div
          className="fleet-chat-composer"
          data-mentioning={liveMentions.length > 0 ? 'true' : 'false'}
        >
          {fleet.canPutOnWork ? (
            <>
              <button
                type="button"
                className="fleet-chat-work-toggle"
                data-active={workMode ? 'true' : 'false'}
                aria-pressed={workMode}
                title={workMode ? BEVEL_COPY.work.toggleOn : BEVEL_COPY.work.toggleOff}
                onClick={() => setWorkMode((v) => !v)}
              >
                {BEVEL_COPY.work.toggle}
              </button>
              {workMode ? (
                <button
                  type="button"
                  className="fleet-chat-work-toggle"
                  data-active={ticketMode ? 'true' : 'false'}
                  data-kind="ticket"
                  aria-pressed={ticketMode}
                  title={ticketMode ? BEVEL_COPY.work.ticketOn : BEVEL_COPY.work.ticketOff}
                  onClick={() => setTicketMode((v) => !v)}
                >
                  {BEVEL_COPY.work.ticket}
                </button>
              ) : null}
            </>
          ) : null}
          <HumanAvatar name={displayName} avatarUrl={fleet.avatarUrl} size="sm" />
          <div className="fleet-chat-composer-field">
            {mentionDraft && mentionCandidates.length > 0 ? (
              <ul
                className="fleet-chat-mention-menu"
                role="listbox"
                aria-label={
                  mentionDraft.kind === 'escalation'
                    ? 'Escalate to person'
                    : 'Mention person or agent'
                }
              >
                {mentionCandidates.map((c, i) => {
                  const active = i === mentionHighlight
                  const key =
                    c.type === 'agent'
                      ? `agent:${c.agent.id}`
                      : `person:${c.person.handle}:${c.escalate ? 'esc' : 'soft'}`
                  const name =
                    c.type === 'agent'
                      ? c.agent.name
                      : c.person.name || c.person.handle
                  const token =
                    c.type === 'agent'
                      ? `@${c.agent.id}`
                      : c.escalate || mentionDraft.kind === 'escalation'
                        ? `^${c.person.handle}`
                        : `@${c.person.handle}`
                  const avatar =
                    c.type === 'agent' ? c.agent.avatar : c.person.imageUrl
                  return (
                    <li key={key} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className="fleet-chat-mention-option"
                        data-active={active ? 'true' : 'false'}
                        data-kind={
                          c.type === 'person' &&
                          (c.escalate || mentionDraft.kind === 'escalation')
                            ? 'escalation'
                            : c.type
                        }
                        onMouseDown={(e) => {
                          e.preventDefault()
                          insertMentionCandidate(c)
                        }}
                        onMouseEnter={() => setMentionHighlight(i)}
                      >
                        {avatar &&
                        typeof avatar === 'string' &&
                        (avatar.startsWith('/') || avatar.startsWith('http')) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt=""
                            className="fleet-chat-mention-option-avatar"
                          />
                        ) : (
                          <span
                            className="fleet-chat-mention-option-avatar fleet-chat-mention-option-avatar--fallback"
                            aria-hidden
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="fleet-chat-mention-option-text">
                          <span className="fleet-chat-mention-option-name">
                            {name}
                          </span>
                          <span className="fleet-chat-mention-option-id">
                            {token}
                            {c.type === 'person' &&
                            (c.escalate || mentionDraft.kind === 'escalation')
                              ? ' · escalate'
                              : c.type === 'person'
                                ? ' · person'
                                : ' · agent'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setCaret(e.target.selectionStart ?? e.target.value.length)
                setMentionHighlight(0)
              }}
              onSelect={(e) => {
                const t = e.currentTarget
                setCaret(t.selectionStart ?? t.value.length)
              }}
              onClick={(e) => {
                const t = e.currentTarget
                setCaret(t.selectionStart ?? t.value.length)
              }}
              onKeyDown={(e) => {
                if (mentionDraft && mentionCandidates.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMentionHighlight(
                      (h) => (h + 1) % mentionCandidates.length,
                    )
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMentionHighlight(
                      (h) =>
                        (h - 1 + mentionCandidates.length) %
                        mentionCandidates.length,
                    )
                    return
                  }
                  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault()
                    const pick =
                      mentionCandidates[mentionHighlight] ?? mentionCandidates[0]
                    if (pick) insertMentionCandidate(pick)
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setCaret(input.length)
                    // break draft by dropping trailing incomplete token marker
                    setInput((v) =>
                      v.endsWith('@') || v.endsWith('^') ? v.slice(0, -1) : v,
                    )
                    return
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder={
                workMode && fleet.canPutOnWork
                  ? isChannel
                    ? BEVEL_COPY.placeholderWork(channelSlug, sampleAgent)
                    : BEVEL_COPY.placeholderWork('session', sampleAgent)
                  : isChannel
                    ? BEVEL_COPY.placeholderChannel(channelSlug, sampleAgent)
                    : sessionPlaceholder
              }
              disabled={!connected || ticketBusy}
              className="fleet-chat-input"
              aria-label="Message"
              aria-autocomplete="list"
              aria-expanded={Boolean(mentionDraft && mentionCandidates.length)}
            />
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!connected || !input.trim() || ticketBusy}
            className="fleet-chat-send btn-pop"
            aria-label="Send message"
          >
            <PaperAirplaneIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!fillViewport ? <BevelPoweredBy className="mt-1 text-center" /> : null}
    </div>
  )
}