'use client'

import type { CSSProperties } from 'react'
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
import { formatSpeaker } from '../lib/system-voice'
import { readRoomSnapshot, writeRoomSnapshot } from '../lib/room-state-cache'
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

/** Pinned inside the shell so connection issues stay visible above the thread. */
function ConnectionNotice({
  issue,
  tone = 'info',
}: {
  issue: BevelConnectionIssue
  tone?: 'info' | 'warn'
}) {
  return (
    <div
      className="fleet-chat-notice"
      data-tone={tone}
      role={tone === 'warn' ? 'alert' : 'status'}
    >
      <p className="fleet-chat-notice-title">{issue.title}</p>
      {issue.hint ? <p className="fleet-chat-notice-hint">{issue.hint}</p> : null}
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
}

/** Hide legacy join/leave/welcome noise still in live room state. */
function isEphemeralChannelNoise(body: string): boolean {
  return (
    /joined ♡|stepped out|i'm derozic|your fleet's listening|welcome in/i.test(body) ||
    /joined #|left #/i.test(body) ||
    /^#\w+ · (roster:|.* is on the roster)/i.test(body)
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

function MessageRow({
  m,
  agents,
  selfName,
}: {
  m: ChatMsg
  agents: FleetAgent[]
  selfName: string
}) {
  if (m.speakerType === 'system') {
    if (isEphemeralChannelNoise(m.body)) return null
    return (
      <div className="fleet-chat-msg-row fleet-chat-msg-row--system">
        <div
          className="fleet-chat-msg-system"
          data-pending={m.status === 'pending' ? 'true' : undefined}
        >
          {m.body}
        </div>
      </div>
    )
  }

  if (m.speakerType === 'human') {
    const isSelf = m.speaker === selfName
    return (
      <div className="fleet-chat-msg-row fleet-chat-msg-row--human">
        <HumanAvatar name={m.speaker} avatarUrl={m.speakerAvatar} size="md" />
        <div className="fleet-chat-bubble fleet-chat-bubble--human">
          {!isSelf ? (
            <p className="fleet-chat-msg-label">{m.speaker}</p>
          ) : null}
          <div className="fleet-chat-msg-body">
            <ChatMessageBody text={m.body} />
          </div>
        </div>
      </div>
    )
  }

  const agent = agents.find((a) => a.id === m.agentId)
  const accent = accentStripeColor(agent?.accent) ?? agent?.accent

  return (
    <div className="fleet-chat-msg-row fleet-chat-msg-row--agent">
      {agent?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={agent.avatar} alt="" className="fleet-chat-avatar" />
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
          {(m.speaker || 'A').charAt(0)}
        </span>
      )}
      <div
        className="fleet-chat-bubble fleet-chat-bubble--agent"
        style={accent ? ({ '--msg-accent': accent } as CSSProperties) : undefined}
      >
        <p className="fleet-chat-msg-label">
          {formatSpeaker(m.speaker, m.speakerType)}
        </p>
        <div className="fleet-chat-msg-body">
          <ChatMessageBody text={m.body} />
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
  const [participants, setParticipants] = useState<HumanParticipant[]>(
    () => bootSnapshot?.participants ?? []
  )
  const [input, setInput] = useState('')
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
  const presenceRoster = useMemo(
    () => dedupeHumanParticipantsByUser(participants),
    [participants]
  )
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
    el.scrollTop = el.scrollHeight
  }, [roomKey])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 96) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

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
    const client = new Client(realtimeUrl)
    client.auth.token = tokenRef.current ?? realtimeToken!

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
      ? { channelSlug, agentIds: joinRoster, displayName: joinDisplayName }
      : {
          ...(resumeSessionId ? { sessionId: resumeSessionId } : {}),
          agentIds: joinRoster,
          displayName: joinDisplayName,
          title: joinTitle,
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
            const raw = message || BEVEL_COPY.errors.roomError(`error ${code}`)
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
            hint: e instanceof Error ? e.message : undefined,
          })
          setConnected(false)
        }
      })
      .catch((e) => {
        window.clearTimeout(connectTimeout)
        if (cancelled) return
        const msg = e instanceof Error ? e.message : BEVEL_COPY.errors.connectionFailed
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

  function mentionedAgents(text: string): string[] {
    const found = new Set<string>()
    for (const m of text.matchAll(/@([a-z0-9_-]+)\b/gi)) {
      const id = m[1].toLowerCase()
      if (catalog.some((a) => a.id === id)) found.add(id)
    }
    if (found.size > 0) return [...found]
    return agentIds.length > 0 ? agentIds : catalog.map((a) => a.id).slice(0, 1)
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
    ? `#${channelSlug}`
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
            ) : (
              <span className="fleet-chat-presence-placeholder" aria-hidden />
            )}
          </div>
        </div>

        <div className="fleet-chat-agents" role="group" aria-label="Agents in channel">
          {catalog.map((a) => (
            <AgentChip
              key={a.id}
              agent={a}
              active={agentIds.includes(a.id)}
              onToggle={() => {
                setAgentIds((prev) =>
                  prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                )
              }}
            />
          ))}
        </div>

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

        <div className="fleet-chat-composer">
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
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
          />
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