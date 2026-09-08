import { Client, Room, ServerError } from 'colyseus'
import { verifyAuthToken } from '../auth-verify.js'
import { dispatchAgentChat } from '../agent-dispatch.js'
import {
  appendChannelMessage,
  fetchChannelMessagesPage,
  persistChannelGesture,
  persistChannelMessageLifecycle,
  type FleetChannelMessageRecord,
} from '../fleet-channel-api.js'
import { enqueuePersist, flushPersistQueue } from '../persist-queue.js'
import { dmPersistSlug } from '../session-persist.js'
import {
  applyGesture,
  formatGestureFeedback,
  isGestureKind,
  parseGestures,
  parseVotePrompt,
  type GestureKind,
} from '../gestures.js'
import { readRecording, recordEvent, type SessionEvent } from '../recording.js'
import { loadMergedRegistry } from '../registry-merge.js'
import {
  ensureAgentsInRoster,
  mentionedCanonicalIds,
  resolveDispatchTargets,
} from '../platform-roster.js'
import {
  AgentPresence,
  AgentSessionState,
  ChatMessage,
  HumanPresence,
} from '../schema/ChatState.js'
import { BEVEL_POWERED_BY_LABEL } from '../product/bevel.js'
import {
  HumanPresenceBook,
  PRESENCE_RECONNECT_SECONDS,
  PRESENCE_TICK_MS,
} from '../human-presence.js'
import { publicAgentBubble, sanitizeAgentError } from '../sanitize-agent-error.js'
import {
  SYSTEM_SPEAKER,
  agentThinking,
  askingFleet,
  handingToAgent,
  memberJoined,
  memberLeft,
  pickAgent,
  sessionWelcome,
} from '../system-voice.js'

type JoinOptions = {
  sessionId?: string
  agentIds?: string[]
  displayName?: string
  title?: string
  authToken?: string
}

type AuthPayload = {
  email: string
  name?: string
  sub: string
  role?: string
  picture?: string
}

type SpeakerProfile = {
  userId: string
  name: string
  avatar: string
}

type GesturePayload = {
  messageId?: string
  kind?: string
}

type MessageActionPayload = {
  messageId?: string
  action?: string
}

type ChatPayload = {
  text: string
  speaker?: string
  targetAgent?: string
  agentIds?: string[]
}

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const ROOM_HISTORY_LIMIT = 100

function conversationalRecordingEvents(sessionId: string): SessionEvent[] {
  return readRecording(sessionId).filter(
    (e) => e.type === 'message' || e.type === 'agent_reply',
  )
}

function eventToChatMessage(ev: SessionEvent, sessionId: string): ChatMessage {
  const msg = new ChatMessage()
  const meta = ev.meta ?? {}
  msg.id = String(meta.messageId ?? `rec_${ev.ts}_${ev.speakerType}`)
  msg.sessionId = sessionId
  msg.speaker = ev.speaker
  msg.speakerId = ev.agentId || ev.speaker
  msg.speakerType = ev.speakerType
  msg.agentId = ev.agentId ?? ''
  msg.body = ev.body
  msg.status = 'final'
  msg.ts = ev.ts
  return msg
}

function recordToChatMessage(
  row: FleetChannelMessageRecord,
  sessionId: string,
): ChatMessage {
  const msg = new ChatMessage()
  msg.id = row.id
  msg.sessionId = sessionId
  msg.speaker = row.speakerName
  msg.speakerId = row.speakerId
  msg.speakerAvatar = row.speakerAvatar ?? ''
  msg.speakerType = row.speakerType
  msg.agentId = row.agentId ?? ''
  msg.body = row.body
  msg.status = row.status
  msg.ts = new Date(row.createdAt).getTime() || Date.now()
  msg.reactionsJson = JSON.stringify(row.reactions ?? [])
  msg.votePrompt = parseVotePrompt(row.body, row.votePrompt)
  return msg
}

export class AgentSession extends Room {
  maxClients = 8
  seatReservationTimeout = 45
  declare state: AgentSessionState
  private speakerNames = new Map<string, string>()
  private speakerProfiles = new Map<string, SpeakerProfile>()
  private persistSlug = 'dm-session'
  private humans: HumanPresenceBook<HumanPresence> | null = null

  static async onAuth(
    token: string,
    options: JoinOptions
  ): Promise<AuthPayload> {
    const authToken = token || options.authToken
    if (!authToken) {
      throw new ServerError(401, 'Sign in required')
    }
    const claims = await verifyAuthToken(authToken)
    if (!claims) {
      throw new ServerError(401, 'Invalid or expired session')
    }
    return claims
  }

  async onCreate(options: JoinOptions) {
    this.setState(new AgentSessionState())
    const sessionId = options.sessionId ?? this.roomId
    this.persistSlug = dmPersistSlug(sessionId)
    this.state.sessionId = sessionId
    this.state.title = options.title ?? `Fleet session`
    this.state.createdAt = Date.now()
    this.state.status = 'active'
    this.state.poweredByLabel = BEVEL_POWERED_BY_LABEL

    const ids = (options.agentIds ?? ['lego']).map((id) => id.toLowerCase())
    const catalog = loadMergedRegistry()
    for (const id of ids) {
      this.state.agentIds.push(id)
      const meta = catalog.find((a) => a.id === id)
      const row = new AgentPresence()
      row.id = id
      row.name = meta?.name ?? id
      row.accent = meta?.accent ?? '#1a1410'
      row.source = meta?.federated ? 'federated' : 'fleet'
      this.state.agents.push(row)
    }

    await this.hydrateHistory(sessionId)

    if (this.state.messages.length === 0) {
      const agentNames = this.state.agents.map((a) => a.name)
      this.pushSystemMessage(sessionWelcome(agentNames), 'final')
    }

    recordEvent({
      ts: Date.now(),
      sessionId,
      type: 'status',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body: `resume ${this.persistSlug} (${this.state.messages.length} messages)`,
      meta: { title: this.state.title, agentIds: ids },
    })

    this.onMessage('chat', (client, payload: ChatPayload) => {
      void this.handleChat(client.sessionId, payload).catch((err) => {
        console.error('[agent_session] chat handler failed', {
          session: this.persistSlug,
          err: err instanceof Error ? err.message : String(err),
        })
        this.pushSystemMessage(
          sanitizeAgentError('Session', err).publicMessage,
          'error',
        )
      })
    })
    this.onMessage('gesture', (client, payload: GesturePayload) => {
      void this.handleGesture(client, payload)
    })
    this.onMessage('message_action', (client, payload: MessageActionPayload) => {
      void this.handleMessageAction(client, payload)
    })
    this.onMessage(
      'presence',
      (client, payload: { visible?: boolean; lastInputAt?: number }) => {
        this.humans?.heartbeat(client.sessionId, {
          visible: payload?.visible,
          lastInputAt: payload?.lastInputAt,
          now: Date.now(),
        })
        this.publishOccupancy()
      },
    )
    this.humans = new HumanPresenceBook(this.state.humans, () => new HumanPresence())
    this.clock.setInterval(() => {
      this.humans?.tick(Date.now())
      this.publishOccupancy()
    }, PRESENCE_TICK_MS)
    this.publishOccupancy()
  }

  async onDispose() {
    const n = await flushPersistQueue(10_000)
    if (n > 0) {
      console.log(
        `[agent_session] ${this.persistSlug} disposed after draining ${n} persist(s)`,
      )
    }
  }

  onJoin(client: Client, options: JoinOptions) {
    const auth = client.auth as AuthPayload | undefined
    const name =
      options.displayName ??
      auth?.name ??
      auth?.email?.split('@')[0] ??
      `operator-${client.sessionId.slice(0, 4)}`
    const profile: SpeakerProfile = {
      userId: auth?.sub ?? client.sessionId,
      name,
      avatar: auth?.picture ?? '',
    }
    this.speakerNames.set(client.sessionId, name)
    this.speakerProfiles.set(client.sessionId, profile)
    this.humans?.join({
      sessionId: client.sessionId,
      userId: profile.userId,
      name: profile.name,
      avatar: profile.avatar,
      now: Date.now(),
    })
    this.publishOccupancy()

    const body = memberJoined(name)
    this.pushSystemMessage(body, 'final')
    recordEvent({
      ts: Date.now(),
      sessionId: this.state.sessionId,
      type: 'join',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body,
    })
  }

  onDrop(client: Client) {
    this.humans?.drop(client.sessionId, Date.now())
    this.publishOccupancy()
    void this.allowReconnection(client, PRESENCE_RECONNECT_SECONDS).then(
      () => {
        this.humans?.reconnect(client.sessionId, Date.now())
        this.publishOccupancy()
      },
      () => {
        /* onLeave removes the seat */
      },
    )
  }

  onReconnect(client: Client) {
    this.humans?.reconnect(client.sessionId, Date.now())
    this.publishOccupancy()
  }

  onLeave(client: Client) {
    const name = this.speakerNames.get(client.sessionId) ?? 'operator'
    const body = memberLeft(name)
    this.pushSystemMessage(body, 'final')
    recordEvent({
      ts: Date.now(),
      sessionId: this.state.sessionId,
      type: 'leave',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body,
    })
    this.speakerNames.delete(client.sessionId)
    this.speakerProfiles.delete(client.sessionId)
    this.humans?.leave(client.sessionId, Date.now())
    this.publishOccupancy()
  }

  private publishOccupancy() {
    const occupancy = this.humans?.occupancy() ?? { humans: 0, reconnecting: 0 }
    this.setMetadata({
      sessionId: this.state.sessionId,
      humans: occupancy.humans,
      reconnecting: occupancy.reconnecting,
    })
  }

  private pushSystemMessage(body: string, status: ChatMessage['status']): ChatMessage {
    const msg = new ChatMessage()
    msg.id = uid()
    msg.sessionId = this.state.sessionId
    msg.speaker = SYSTEM_SPEAKER
    msg.speakerType = 'system'
    msg.body = body
    msg.status = status
    msg.ts = Date.now()
    this.pushMessage(msg)
    return msg
  }

  private removeMessageById(id: string): void {
    for (let i = 0; i < this.state.messages.length; i++) {
      if (this.state.messages[i]?.id === id) {
        this.state.messages.splice(i, 1)
        return
      }
    }
  }

  private pushMessage(msg: ChatMessage) {
    if (this.state.messages.length > 200) {
      this.state.messages.shift()
    }
    this.state.messages.push(msg)
  }

  private async hydrateHistory(sessionId: string): Promise<void> {
    const page = await fetchChannelMessagesPage(this.persistSlug, {
      limit: ROOM_HISTORY_LIMIT,
    })
    for (const row of page.messages) {
      this.pushMessage(recordToChatMessage(row, sessionId))
    }
    if (this.state.messages.length > 0) return

    // Pre-persist era: JSONL recordings on disk. Promote them into Postgres
    // so the next refresh does not depend on the file still being there.
    const recovered = conversationalRecordingEvents(sessionId)
    for (const ev of recovered) {
      const msg = eventToChatMessage(ev, sessionId)
      this.pushMessage(msg)
      void this.persistMessage({
        id: msg.id,
        speakerId: msg.speakerId || msg.agentId || ev.speaker,
        speakerName: msg.speaker,
        speakerAvatar: msg.speakerAvatar,
        speakerType: msg.speakerType,
        agentId: msg.agentId || undefined,
        body: msg.body,
        status: msg.status || 'final',
        createdAt: new Date(msg.ts).toISOString(),
        votePrompt: msg.votePrompt || undefined,
      })
    }
  }

  private persistMessage(msg: {
    id: string
    speakerId: string
    speakerName: string
    speakerAvatar?: string
    speakerType: string
    agentId?: string
    body: string
    status: string
    createdAt?: string
    reactions?: ReturnType<typeof parseGestures>
    votePrompt?: string
  }): Promise<boolean> {
    return enqueuePersist(msg.id, () =>
      appendChannelMessage(this.persistSlug, {
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName: msg.speakerName,
        speakerAvatar: msg.speakerAvatar,
        speakerType: msg.speakerType,
        agentId: msg.agentId,
        body: msg.body,
        status: msg.status,
        createdAt: msg.createdAt,
        reactions: msg.reactions,
        votePrompt: msg.votePrompt,
        tags: ['dm', 'direct'],
      }),
    )
  }

  private async handleChat(clientSessionId: string, payload: ChatPayload) {
    const text = payload.text?.trim()
    if (!text) return

    const profile =
      this.speakerProfiles.get(clientSessionId) ??
      ({
        userId: clientSessionId,
        name: payload.speaker ?? 'operator',
        avatar: '',
      } satisfies SpeakerProfile)
    const speaker = profile.name
    const human = new ChatMessage()
    human.id = uid()
    human.sessionId = this.state.sessionId
    human.speaker = speaker
    human.speakerId = profile.userId
    human.speakerAvatar = profile.avatar
    human.speakerType = 'human'
    human.body = text
    human.status = 'final'
    human.ts = Date.now()
    this.pushMessage(human)

    recordEvent({
      ts: human.ts,
      sessionId: this.state.sessionId,
      type: 'message',
      speaker,
      speakerType: 'human',
      body: text,
      meta: { messageId: human.id },
    })

    void this.persistMessage({
      id: human.id,
      speakerId: human.speakerId,
      speakerName: human.speaker,
      speakerAvatar: human.speakerAvatar,
      speakerType: 'human',
      body: text,
      status: 'final',
      createdAt: new Date(human.ts).toISOString(),
    }).then((humanOk) => {
      if (!humanOk) {
        console.error('[agent_session] human message not durable', {
          session: this.persistSlug,
          id: human.id,
        })
      }
    })

    this.seatIncomingAgents(text, payload)
    const targets = this.resolveTargetAgents(text, payload.targetAgent)
    if (targets.length === 0) {
      const names = this.state.agents.map((a) => a.name)
      const body = pickAgent(names)
      this.pushSystemMessage(body, 'final')
      recordEvent({
        ts: Date.now(),
        sessionId: this.state.sessionId,
        type: 'status',
        speaker: SYSTEM_SPEAKER,
        speakerType: 'system',
        body,
      })
      return
    }

    await this.dispatchToAgents(targets, text)
  }

  private chatHistory() {
    return this.state.messages
      .filter((m) => m.status === 'final' && m.speakerType !== 'system')
      .slice(-12)
      .map((m) => {
        const signals = formatGestureFeedback(parseGestures(m.reactionsJson))
        return {
          role: m.speakerType === 'human' ? 'user' : 'assistant',
          content: signals ? `${m.body}\n[${signals}]` : m.body,
        }
      })
  }

  private findMessage(id: string): ChatMessage | undefined {
    for (let i = 0; i < this.state.messages.length; i++) {
      const row = this.state.messages[i]
      if (row?.id === id) return row
    }
    return undefined
  }

  private async handleMessageAction(client: Client, payload: MessageActionPayload) {
    const actionRaw = String(payload.action ?? '').trim().toLowerCase()
    const messageId = String(payload.messageId ?? '').trim()
    if (!messageId || (actionRaw !== 'delete' && actionRaw !== 'archive')) return
    const profile = this.speakerProfiles.get(client.sessionId)
    if (!profile) return
    if (!this.findMessage(messageId)) return
    this.removeMessageById(messageId)
    void enqueuePersist(`lifecycle:${messageId}`, () =>
      persistChannelMessageLifecycle(this.persistSlug, messageId, actionRaw),
    )
  }

  private async handleGesture(client: Client, payload: GesturePayload) {
    const kindRaw = String(payload.kind ?? '').trim().toLowerCase()
    const messageId = String(payload.messageId ?? '').trim()
    if (!messageId || !isGestureKind(kindRaw)) return
    const kind = kindRaw as GestureKind
    const profile = this.speakerProfiles.get(client.sessionId)
    if (!profile) return
    const msg = this.findMessage(messageId)
    if (!msg || msg.speakerType === 'system') return
    if (msg.status === 'pending' || msg.status === 'streaming') return
    const next = applyGesture(parseGestures(msg.reactionsJson), {
      kind,
      userId: profile.userId,
      userName: profile.name,
    })
    msg.reactionsJson = JSON.stringify(next)
    void enqueuePersist(`gesture:${msg.id}`, () =>
      persistChannelGesture(this.persistSlug, msg.id, {
        kind,
        userId: profile.userId,
        userName: profile.name,
      }),
    )
    recordEvent({
      ts: Date.now(),
      sessionId: this.state.sessionId,
      type: 'gesture',
      speaker: profile.name,
      speakerType: 'human',
      body: `${kind} on ${messageId}`,
      meta: { messageId, kind, agentId: msg.agentId },
    })
    if (kind === 'down' && msg.speakerType === 'agent' && msg.agentId) {
      const agentName =
        this.state.agents.find((a) => a.id === msg.agentId)?.name || msg.agentId
      try {
        const res = await dispatchAgentChat(
          msg.agentId,
          `${profile.name} marked your last reply with thumbs down. Briefly acknowledge and offer a better take.\n\nOriginal:\n${msg.body.slice(0, 1200)}`,
          this.chatHistory(),
          { personalAgent: true },
        )
        this.pushAgentReply(msg.agentId, agentName, res.output || 'Understood — retrying.')
      } catch (err) {
        console.error('[agent_session] gesture feedback dispatch failed', err)
      }
    }
  }

  private pushAgentReply(target: string, agentName: string, output: string, meta?: Record<string, unknown>) {
    output = publicAgentBubble(agentName, output)
    const reply = new ChatMessage()
    reply.id = uid()
    reply.sessionId = this.state.sessionId
    reply.speaker = agentName
    reply.speakerType = 'agent'
    reply.agentId = target
    reply.body = output
    reply.status = 'final'
    reply.ts = Date.now()
    reply.votePrompt = parseVotePrompt(output)
    this.pushMessage(reply)

    recordEvent({
      ts: reply.ts,
      sessionId: this.state.sessionId,
      type: 'agent_reply',
      speaker: reply.speaker,
      speakerType: 'agent',
      agentId: target,
      body: output,
      meta: { ...meta, messageId: reply.id },
    })

    void this.persistMessage({
      id: reply.id,
      speakerId: target,
      speakerName: agentName,
      speakerType: 'agent',
      agentId: target,
      body: output,
      status: 'final',
      createdAt: new Date(reply.ts).toISOString(),
      votePrompt: reply.votePrompt || undefined,
    })
  }

  private async dispatchToAgents(targets: string[], text: string) {
    const agentNames = targets.map((t) => this.state.agents.find((a) => a.id === t)?.name ?? t)
    const statusMsg = this.pushSystemMessage(
      targets.length === 1 ? handingToAgent(agentNames[0]) : askingFleet(agentNames),
      'pending'
    )

    recordEvent({
      ts: statusMsg.ts,
      sessionId: this.state.sessionId,
      type: 'status',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body: statusMsg.body,
      meta: { agentIds: targets, phase: 'handoff' },
    })

    const history = this.chatHistory()
    statusMsg.body = agentThinking(agentNames.join(', '))
    statusMsg.ts = Date.now()

    for (const target of targets) {
      const agentRow = this.state.agents.find((a) => a.id === target)
      if (agentRow) agentRow.status = 'thinking'
    }

    const results = await Promise.allSettled(
      targets.map(async (target) => {
        const agentName = this.state.agents.find((a) => a.id === target)?.name ?? target
        // Solo direct thread (/talk/hermes) → personal agent mode for Hermes.
        const solo = this.state.agentIds.length === 1
        const res = await dispatchAgentChat(target, text, history, {
          personalAgent: solo && target.toLowerCase() === 'hermes',
        })
        return { target, agentName, res }
      })
    )

    this.removeMessageById(statusMsg.id)

    for (let i = 0; i < results.length; i++) {
      const target = targets[i]
      const agentRow = this.state.agents.find((a) => a.id === target)
      if (agentRow) agentRow.status = 'idle'

      const result = results[i]
      if (result.status === 'fulfilled') {
        const { agentName, res } = result.value
        this.pushAgentReply(target, agentName, res.output, {
          model: res.model,
          confidence: res.confidence,
        })
      } else {
        const agentName = agentRow?.name ?? target
        const sanitized = sanitizeAgentError(agentName, result.reason)
        console.error('[agent_session] agent failed', {
          session: this.persistSlug,
          agent: target,
          code: sanitized.code,
          detail: sanitized.detail,
        })
        this.pushAgentReply(target, agentName, sanitized.publicMessage, {
          phase: 'error',
          rateLimited: sanitized.code === 'rate_limit',
        })
      }
    }
  }

  private seatIncomingAgents(text: string, payload: ChatPayload) {
    const seated = [...this.state.agents].map((a) => ({
      id: a.id,
      name: a.name,
    }))
    const incoming = Array.isArray(payload.agentIds) ? payload.agentIds : []
    ensureAgentsInRoster(this.state, [
      ...incoming,
      ...(payload.targetAgent ? [payload.targetAgent] : []),
      ...mentionedCanonicalIds(text, seated),
    ])
  }

  private resolveTargetAgents(text: string, explicit?: string): string[] {
    return resolveDispatchTargets({
      text,
      explicit,
      agentIds: [...this.state.agentIds],
      agents: [...this.state.agents].map((a) => ({ id: a.id, name: a.name })),
    })
  }

  getTranscript() {
    return this.state.messages.map((m) => ({
      id: m.id,
      speaker: m.speaker,
      speakerType: m.speakerType,
      agentId: m.agentId,
      body: m.body,
      status: m.status,
      ts: m.ts,
    }))
  }
}