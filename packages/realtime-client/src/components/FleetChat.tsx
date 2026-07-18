'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Client, getStateCallbacks, type Room } from '@colyseus/sdk'
import { Bars3Icon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
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
  applyMention,
  filterMentionCandidates,
  mentionDraftAt,
  mentionedAgentIds,
} from '../lib/mentions'
import { formatSpeaker } from '../lib/system-voice'
import { readRoomSnapshot, writeRoomSnapshot } from '../lib/room-state-cache'
import {
  formatFleetError,
  formatRoomErrorEvent,
  sanitizeErrorText,
} from '../lib/format-error'
import { cn } from '../lib/utils'
import {
  BEVEL_COPY,
  isSeatReservationExpired,
  resolveBevelConnectionIssue,
  type BevelConnectionIssue,
} from '../product/bevel-copy'
import type { FleetAgent } from '../types'
import { AgentChip } from './AgentChip'
import { HumanAvatar } from './HumanAvatar'
import { BevelPoweredBy } from './BevelPoweredBy'

const SEAT_RETRY_MAX = 2
const SEAT_RETRY_DELAY_MS = 700

/** Known agent portrait paths served from apps/web/public/avatars. */
const KNOWN_AGENT_AVATARS: Record<string, string> = {
  brain: '/avatars/brain.svg',
  loom: '/avatars/loom.svg',
  lego: '/avatars/lego.svg',
  northstar: '/avatars/northstar.svg',
  tegan: '/avatars/tegan.svg',
  johnny: '/avatars/johnny.svg',
  hermes: '/avatars/hermes.svg',
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
  if (key && KNOWN_AGENT_AVATARS[key]) return KNOWN_AGENT_AVATARS[key]
  const byName = Object.keys(KNOWN_AGENT_AVATARS).find((id) =>
    (speaker || '').toLowerCase().includes(id),
  )
  return byName ? KNOWN_AGENT_AVATARS[byName] : undefined
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
      hint:
        sanitizeErrorText(issue.hint) ||
        'Reload the page. If it persists, restart realtime on port 43208.',
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
      <p className="fleet-chat-notice-title">{safe.title}</p>
      {safe.hint ? <p className="fleet-chat-notice-hint">{safe.hint}</p> : null}
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
  // Humans: speaker is already the display string from the room
  if (nameStyle === 'display_only') {
    const first = speaker.trim().split(/\s+/)[0]
    return first || speaker
  }
  return speaker
}

function MessageRow({
  m,
  agents,
  selfName,
  focused,
  highlightQuery,
  showAvatars = true,
  nameStyle = 'full_and_display',
}: {
  m: ChatMsg
  agents: FleetAgent[]
  selfName: string
  focused?: boolean
  highlightQuery?: string
  showAvatars?: boolean
  nameStyle?: 'full_and_display' | 'display_only'
}) {
  const rowProps = {
    id: `msg-${m.id}`,
    'data-message-id': m.id,
    'data-focused': focused ? 'true' : undefined,
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
    const isSelf = m.speaker === selfName
    const label = formatMessageName(m.speaker, nameStyle)
    return (
      <div className="fleet-chat-msg-row fleet-chat-msg-row--human" {...rowProps}>
        {showAvatars ? (
          <HumanAvatar name={m.speaker} avatarUrl={m.speakerAvatar} size="md" />
        ) : (
          <span className="fleet-chat-avatar-spacer" aria-hidden />
        )}
        <div className="fleet-chat-bubble fleet-chat-bubble--human">
          {!isSelf ? (
            <p className="fleet-chat-msg-label">{label}</p>
          ) : null}
          <div className="fleet-chat-msg-body">
            {highlightQuery?.trim() ? (
              <p className="whitespace-pre-wrap">
                <HighlightedText text={m.body} query={highlightQuery} />
              </p>
            ) : (
              <ChatMessageBody text={m.body} />
            )}
          </div>
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
      <div
        className="fleet-chat-bubble fleet-chat-bubble--agent"
        style={accent ? ({ '--msg-accent': accent } as CSSProperties) : undefined}
      >
        <p className="fleet-chat-msg-label">{agentLabel}</p>
        <div className="fleet-chat-msg-body">
          {highlightQuery?.trim() ? (
            <p className="whitespace-pre-wrap">
              <HighlightedText text={m.body} query={highlightQuery} />
            </p>
          ) : (
            <ChatMessageBody text={m.body} />
          )}
        </div>
      </div>
    </div>
  )
}

export function FleetChat({
  initialAgents = ['hermes', 'johnny'],
  agents: agentsProp,
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
  const roomKey = isChannel
    ? `channel:${channelSlug}`
    : `session:${resumeSessionId ?? 'new'}`
  const bootSnapshot = readRoomSnapshot(roomKey)
  const bootHasThread = Boolean(
    bootSnapshot?.messages.some((m) => m.speakerType !== 'system')
  )

  const [connected, setConnected] = useState(false)
  const [uiLive, setUiLive] = useState(bootHasThread)
  const [messages, setMessages] = useState<ChatMsg[]>(() => bootSnapshot?.messages ?? [])
  const notifiedProgramIds = useRef<Set<string>>(new Set())
  const [participants, setParticipants] = useState<HumanParticipant[]>(
    () => bootSnapshot?.participants ?? []
  )
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [agentIds, setAgentIds] = useState<string[]>(() =>
    bootSnapshot?.agentIds?.length ? bootSnapshot.agentIds : initialAgents
  )
  const joinRosterRef = useRef(initialAgents)
  const displayNameRef = useRef(displayName)
  const sessionTitleRef = useRef(newSessionTitle)
  const tokenRef = useRef(realtimeToken)
  displayNameRef.current = displayName
  sessionTitleRef.current = newSessionTitle
  tokenRef.current = realtimeToken
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
  const threadRef = useRef<HTMLDivElement>(null)
  const tokenReady = Boolean(realtimeToken)
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
    if (distanceFromBottom < 96) {
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
        setIssue(
          resolveBevelConnectionIssue('connection timed out', {
            isChannel,
            realtimeUrl,
          })
        )
        setConnected(false)
      }
    }, 15_000)

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
              const merged =
                idx === -1
                  ? [...prev, next]
                  : prev.map((m) => (m.id === next.id ? next : m))
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
                if (prev.length >= synced.length) return dedupeMessagesById(prev)
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
        if (isSeatReservationExpired(msg) && connectionAttempt < SEAT_RETRY_MAX) {
          setIssue({ title: BEVEL_COPY.errors.seatReservationRetry })
          scheduleSeatRetry(() => cancelled, () => setConnectionAttempt((n) => n + 1))
          return
        }
        setIssue(resolveBevelConnectionIssue(msg, { isChannel, realtimeUrl }))
      })

    return () => {
      cancelled = true
      window.clearTimeout(connectTimeout)
      if (connectGenRef.current === gen) {
        roomRef.current?.leave()
        roomRef.current = null
      }
    }
  }, [roomKey, connectionAttempt, fleet.realtimeUrl, isChannel, tokenReady])

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
  const mentionCandidates = useMemo(() => {
    if (!mentionDraft) return []
    return filterMentionCandidates(catalog, mentionDraft.query)
  }, [catalog, mentionDraft])

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

  function insertMention(agentId: string) {
    if (!mentionDraft) return
    const { text, caret: nextCaret } = applyMention(input, mentionDraft, agentId)
    setInput(text)
    setCaret(nextCaret)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function send() {
    const text = input.trim()
    if (!text || !roomRef.current || ticketBusy) return

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

    const directTarget =
      !isChannel && agentIds.length === 1 ? agentIds[0] : undefined

    roomRef.current.send('chat', {
      text: message,
      speaker: displayName,
      ...(directTarget ? { targetAgent: directTarget } : {}),
      work,
      workRepo: work ? activeWorkRepo : undefined,
    })
    setInput('')
  }

  const sessionsPath = fleet.sessionsPath
  const headerLabel = isChannel
    ? `^${channelSlug}`
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
              tone={issue.hint ? 'warn' : 'info'}
            />
          ) : showConnectingNotice ? (
            <div className="fleet-chat-notice" data-tone="info">
              <p className="fleet-chat-notice-title">{connectingLabel}</p>
            </div>
          ) : (
            <span className="fleet-chat-notice-placeholder" aria-hidden />
          )}
        </div>

        <div ref={threadRef} className="fleet-chat-thread">
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
              focused={focusMessageId === m.id}
              highlightQuery={highlightQuery}
              showAvatars={showAvatars}
              nameStyle={nameStyle}
            />
          ))}
        </div>

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
                aria-label="Mention agent"
              >
                {mentionCandidates.map((a, i) => {
                  const active = i === mentionHighlight
                  return (
                    <li key={a.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className="fleet-chat-mention-option"
                        data-active={active ? 'true' : 'false'}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          insertMention(a.id)
                        }}
                        onMouseEnter={() => setMentionHighlight(i)}
                      >
                        {a.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.avatar}
                            alt=""
                            className="fleet-chat-mention-option-avatar"
                          />
                        ) : (
                          <span
                            className="fleet-chat-mention-option-avatar fleet-chat-mention-option-avatar--fallback"
                            aria-hidden
                          >
                            {a.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="fleet-chat-mention-option-text">
                          <span className="fleet-chat-mention-option-name">
                            {a.name}
                          </span>
                          <span className="fleet-chat-mention-option-id">
                            @{a.id}
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
                    if (pick) insertMention(pick.id)
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setCaret(input.length)
                    // break draft by moving caret conceptually — append space if needed
                    setInput((v) => (v.endsWith('@') ? v.slice(0, -1) : v))
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