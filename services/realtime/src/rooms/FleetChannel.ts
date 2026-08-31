import { Client, Room, ServerError } from 'colyseus'
import { verifyAuthToken } from '../auth-verify.js'
import { dispatchAgentChat, dispatchAgentWork } from '../agent-dispatch.js'
import { canDispatchWork, normalizeWorkRepo } from '../work-repos.js'
import {
  appendChannelMessage,
  fetchChannel,
  fetchChannelMessagesPage,
  persistChannelGesture,
  type FleetChannelMessageRecord,
} from '../fleet-channel-api.js'
import { enqueuePersist, flushPersistQueue } from '../persist-queue.js'
import {
  applyGesture,
  formatGestureFeedback,
  isGestureKind,
  parseGestures,
  parseVotePrompt,
  type GestureKind,
} from '../gestures.js'
import { logAgentWorkToProduct } from '../product-log.js'
import { BEVEL_POWERED_BY_LABEL } from '../product/bevel.js'
import { recordEvent } from '../recording.js'
import { conversationSearchIndex } from '../search-index.js'
import { loadMergedRegistry } from '../registry-merge.js'
import {
  ensureAgentsInRoster,
  mentionedCanonicalIds,
  resolveDispatchTargets,
} from '../platform-roster.js'
import {
  AgentPresence,
  ChatMessage,
  FleetChannelState,
  HumanPresence,
} from '../schema/ChatState.js'
import { removeHumansByUserId } from '../human-presence.js'
import {
  SYSTEM_SPEAKER,
  agentThinking,
  askingFleet,
  channelMemberJoined,
  fleetRateLimited,
  handingToAgent,
  pickAgent,
  puttingOnWork,
  workAccessDenied,
} from '../system-voice.js'

type JoinOptions = {
  channelSlug?: string
  tenantSlug?: string
  agentIds?: string[]
  displayName?: string
  authToken?: string
}

type AuthPayload = {
  email: string
  name?: string
  sub: string
  role?: string
  picture?: string
  repoWrite?: boolean
}

type SpeakerProfile = {
  userId: string
  name: string
  avatar: string
}

type ChatPayload = {
  text: string
  speaker?: string
  targetAgent?: string
  /** Client roster — newly added chips are seated on the next turn. */
  agentIds?: string[]
  work?: boolean
  workRepo?: string
}

type LoadHistoryPayload = {
  before?: string
  beforeId?: string
  limit?: number
}

type GesturePayload = {
  messageId?: string
  kind?: string
}

/** Initial room hydrate size (Colyseus shared state). Older history is paged per-client. */
const ROOM_HISTORY_LIMIT = 100
const PAGE_HISTORY_LIMIT = 50

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Parse in-message tags. Prefer `^tag`; still accept legacy `#tag`. */
function parseMessageTags(text: string): string[] {
  const tags = new Set<string>()
  for (const m of text.matchAll(/[#^]([a-z0-9][a-z0-9_-]*)\b/gi)) {
    tags.add(m[1].toLowerCase())
  }
  return [...tags]
}

function recordToChatMessage(row: FleetChannelMessageRecord, channelSlug: string): ChatMessage {
  const msg = new ChatMessage()
  msg.id = row.id
  msg.sessionId = channelSlug
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

export class FleetChannel extends Room {
  maxClients = 32
  seatReservationTimeout = 30
  declare state: FleetChannelState
  private channelSlug = 'general'
  private tenantSlug = ''
  private speakerNames = new Map<string, string>()
  private speakerProfiles = new Map<string, SpeakerProfile>()
  /** True when Postgres has messages older than the shared room state window. */
  private historyHasMore = false
  private historyNextBefore: string | null = null
  private historyNextBeforeId: string | null = null

  static async onAuth(token: string, options: JoinOptions): Promise<AuthPayload> {
    const authToken = token || options.authToken
    if (!authToken) throw new ServerError(401, 'Sign in required')
    const claims = await verifyAuthToken(authToken)
    if (!claims) throw new ServerError(401, 'Invalid or expired session')
    return claims
  }

  onCreate(options: JoinOptions) {
    this.setState(new FleetChannelState())
    this.channelSlug = (options.channelSlug ?? 'general').toLowerCase()
    this.tenantSlug = (options.tenantSlug ?? '').toLowerCase()
    this.state.channelSlug = this.channelSlug
    this.state.createdAt = Date.now()
    this.state.status = 'active'
    this.state.poweredByLabel = BEVEL_POWERED_BY_LABEL
    this.state.title = `~${this.channelSlug}`

    const agentIds = (options.agentIds?.length ? options.agentIds : ['hermes', 'johnny']).map(
      (id) => id.toLowerCase(),
    )
    const catalog = loadMergedRegistry()
    for (const id of agentIds) {
      this.state.agentIds.push(id)
      const meta = catalog.find((a) => a.id === id)
      const row = new AgentPresence()
      row.id = id
      row.name = meta?.name ?? id
      row.accent = meta?.accent ?? '#1a1410'
      row.source = meta?.federated ? 'federated' : 'fleet'
      this.state.agents.push(row)
    }

    // Do not await Postgres here. Colyseus holds the seat reservation until
    // onCreate finishes; a slow API call expires the join (close 4002).
    this.onMessage('chat', (client, payload: ChatPayload) => {
      void this.handleChat(client, payload)
    })
    this.onMessage('load_history', (client, payload: LoadHistoryPayload) => {
      void this.handleLoadHistory(client, payload)
    })
    this.onMessage('gesture', (client, payload: GesturePayload) => {
      void this.handleGesture(client, payload)
    })
    void this.hydrateFromApi(options)
  }

  private async hydrateFromApi(options: JoinOptions) {
    const channel = await fetchChannel(this.channelSlug, this.tenantSlug || null)
    if (channel?.name) this.state.title = channel.name
    if (channel?.tags?.length && this.state.tags.length === 0) {
      for (const tag of channel.tags) this.state.tags.push(tag)
    }
    if (!options.agentIds?.length && channel?.defaultAgentIds?.length) {
      // Roster already seeded from join options; skip mutating live presence.
    }

    const page = await fetchChannelMessagesPage(this.channelSlug, {
      limit: ROOM_HISTORY_LIMIT,
      tenant: this.tenantSlug || null,
    })
    this.historyHasMore = page.hasMore
    this.historyNextBefore = page.nextBefore
    this.historyNextBeforeId = page.nextBeforeId

    for (const row of page.messages) {
      if (this.findMessage(row.id)) continue
      const msg = recordToChatMessage(row, this.channelSlug)
      this.pushMessage(msg)
      if (row.speakerType !== 'system' && row.body?.trim()) {
        conversationSearchIndex.indexDocument({
          key: `${this.channelSlug}::${row.id}`,
          messageId: row.id,
          sessionId: this.channelSlug,
          kind: 'channel',
          channelSlug: this.channelSlug,
          speaker: row.speakerName,
          speakerType: row.speakerType,
          agentId: row.agentId,
          body: row.body,
          ts: msg.ts,
        })
        conversationSearchIndex.markReady()
      }
    }
  }

  async onDispose() {
    const n = await flushPersistQueue(10_000)
    if (n > 0) {
      console.log(
        `[fleet_channel] ~${this.channelSlug} disposed after draining ${n} persist(s)`,
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

    removeHumansByUserId(this.state.humans, profile.userId)

    const row = new HumanPresence()
    row.clientId = client.sessionId
    row.userId = profile.userId
    row.name = profile.name
    row.avatar = profile.avatar
    this.state.humans.push(row)

    recordEvent({
      ts: Date.now(),
      sessionId: this.channelSlug,
      type: 'join',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body: channelMemberJoined(name, this.channelSlug),
    })

    // Tell the joiner whether older history exists beyond shared room state.
    client.send('history_meta', {
      hasMore: this.historyHasMore,
      nextBefore: this.historyNextBefore,
      nextBeforeId: this.historyNextBeforeId,
      channelSlug: this.channelSlug,
    })
  }

  onLeave(client: Client) {
    const name = this.speakerNames.get(client.sessionId) ?? 'operator'
    this.speakerNames.delete(client.sessionId)
    this.speakerProfiles.delete(client.sessionId)
    for (let i = 0; i < this.state.humans.length; i++) {
      if (this.state.humans[i]?.clientId === client.sessionId) {
        this.state.humans.splice(i, 1)
        break
      }
    }
  }

  private pushSystemMessage(body: string, status: ChatMessage['status']): ChatMessage {
    const msg = new ChatMessage()
    msg.id = uid()
    msg.sessionId = this.channelSlug
    msg.speaker = SYSTEM_SPEAKER
    msg.speakerType = 'system'
    msg.body = body
    msg.status = status
    msg.ts = Date.now()
    this.pushMessage(msg)
    return msg
  }

  private pushMessage(msg: ChatMessage) {
    if (this.state.messages.length > 500) this.state.messages.shift()
    this.state.messages.push(msg)
  }

  private removeMessageById(id: string): void {
    for (let i = 0; i < this.state.messages.length; i++) {
      if (this.state.messages[i]?.id === id) {
        this.state.messages.splice(i, 1)
        return
      }
    }
  }

  /** Durable write tracked for shutdown drain. Keyed by message id. */
  private persistMessage(
    msg: {
      id: string
      speakerId: string
      speakerName: string
      speakerAvatar?: string
      speakerType: string
      agentId?: string
      body: string
      status: string
      tags?: string[]
      createdAt?: string
      reactions?: ReturnType<typeof parseGestures>
      votePrompt?: string
    },
  ): Promise<boolean> {
    return enqueuePersist(msg.id, () =>
      appendChannelMessage(
        this.channelSlug,
        {
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName: msg.speakerName,
        speakerAvatar: msg.speakerAvatar,
        speakerType: msg.speakerType,
        agentId: msg.agentId,
        body: msg.body,
        status: msg.status,
        tags: msg.tags,
        createdAt: msg.createdAt,
        reactions: msg.reactions,
        votePrompt: msg.votePrompt,
        },
        this.tenantSlug || null,
      ),
    )
  }

  private findMessage(id: string): ChatMessage | undefined {
    for (let i = 0; i < this.state.messages.length; i++) {
      const row = this.state.messages[i]
      if (row?.id === id) return row
    }
    return undefined
  }

  private async handleGesture(client: Client, payload: GesturePayload) {
    const kindRaw = String(payload.kind ?? '').trim().toLowerCase()
    const messageId = String(payload.messageId ?? '').trim()
    if (!messageId || !isGestureKind(kindRaw)) return
    const kind = kindRaw as GestureKind
    const profile = this.speakerProfiles.get(client.sessionId)
    if (!profile) return
    const msg = this.findMessage(messageId)
    if (!msg || msg.status === 'pending' || msg.status === 'streaming') return
    if (msg.speakerType === 'system') return

    const next = applyGesture(parseGestures(msg.reactionsJson), {
      kind,
      userId: profile.userId,
      userName: profile.name,
    })
    msg.reactionsJson = JSON.stringify(next)

    recordEvent({
      ts: Date.now(),
      sessionId: this.channelSlug,
      type: 'gesture',
      speaker: profile.name,
      speakerType: 'human',
      body: `${kind} on ${messageId}`,
      meta: { messageId, kind, agentId: msg.agentId },
    })

    void enqueuePersist(`gesture:${msg.id}`, () =>
      persistChannelGesture(
        this.channelSlug,
        msg.id,
        {
        kind,
        userId: profile.userId,
        userName: profile.name,
        },
        this.tenantSlug || null,
      ),
    )

    // Thumbs-down on an agent turn is an immediate course-correct signal.
    if (kind === 'down' && msg.speakerType === 'agent' && msg.agentId) {
      void this.dispatchGestureFeedback(msg, profile.name)
    }
  }

  private async dispatchGestureFeedback(msg: ChatMessage, operatorName: string) {
    const agentId = msg.agentId
    if (!agentId) return
    const agentName =
      this.state.agents.find((a) => a.id === agentId)?.name || agentId
    try {
      const res = await dispatchAgentChat(
        agentId,
        `${operatorName} marked your last reply with thumbs down. Briefly acknowledge and offer a better take.\n\nOriginal:\n${msg.body.slice(0, 1200)}`,
        this.chatHistory(),
        { channelSlug: this.channelSlug },
      )
      await this.pushAgentReply(agentId, agentName, res.output || 'Understood — retrying.')
    } catch (err) {
      console.error('[fleet_channel] gesture feedback dispatch failed', err)
    }
  }

  private async handleLoadHistory(client: Client, payload: LoadHistoryPayload) {
    const limit = Math.max(1, Math.min(payload.limit ?? PAGE_HISTORY_LIMIT, 100))
    const before = payload.before ?? this.historyNextBefore ?? undefined
    const beforeId = payload.beforeId ?? this.historyNextBeforeId ?? undefined
    if (!before) {
      client.send('history', {
        messages: [],
        hasMore: false,
        nextBefore: null,
        nextBeforeId: null,
        channelSlug: this.channelSlug,
      })
      return
    }

    const page = await fetchChannelMessagesPage(this.channelSlug, {
      limit,
      before,
      beforeId,
      tenant: this.tenantSlug || null,
    })

    client.send('history', {
      messages: page.messages.map((m) => ({
        id: m.id,
        speaker: m.speakerName,
        speakerId: m.speakerId,
        speakerAvatar: m.speakerAvatar ?? '',
        speakerType: m.speakerType,
        agentId: m.agentId ?? '',
        body: m.body,
        status: m.status,
        ts: new Date(m.createdAt).getTime() || Date.now(),
        reactions: m.reactions ?? [],
        votePrompt: parseVotePrompt(m.body, m.votePrompt),
      })),
      hasMore: page.hasMore,
      nextBefore: page.nextBefore,
      nextBeforeId: page.nextBeforeId,
      channelSlug: this.channelSlug,
    })
  }

  private async handleChat(client: Client, payload: ChatPayload) {
    const text = payload.text?.trim()
    if (!text) return

    const clientSessionId = client.sessionId
    const auth = client.auth as AuthPayload | undefined

    const profile =
      this.speakerProfiles.get(clientSessionId) ??
      ({
        userId: clientSessionId,
        name: 'operator',
        avatar: '',
      } satisfies SpeakerProfile)

    const tags = parseMessageTags(text)
    const human = new ChatMessage()
    human.id = uid()
    human.sessionId = this.channelSlug
    human.speaker = profile.name
    human.speakerId = profile.userId
    human.speakerAvatar = profile.avatar
    human.speakerType = 'human'
    human.body = text
    human.status = 'final'
    human.ts = Date.now()
    this.pushMessage(human)

    recordEvent({
      ts: human.ts,
      sessionId: this.channelSlug,
      type: 'message',
      speaker: human.speaker,
      speakerType: 'human',
      body: text,
      meta: { messageId: human.id, channelSlug: this.channelSlug, tags },
    })

    // Await human turn durability before agent dispatch — survives mid-flight restart.
    const humanOk = await this.persistMessage({
      id: human.id,
      speakerId: human.speakerId,
      speakerName: human.speaker,
      speakerAvatar: human.speakerAvatar || undefined,
      speakerType: 'human',
      body: text,
      status: 'final',
      tags,
      createdAt: new Date(human.ts).toISOString(),
    })
    if (!humanOk) {
      console.error('[fleet_channel] human message not durable', {
        channel: this.channelSlug,
        id: human.id,
      })
    }

    this.seatIncomingAgents(text, payload)
    const targets = this.resolveTargetAgents(text, payload.targetAgent)
    if (targets.length === 0) {
      const names = this.state.agents.map((a) => a.name)
      this.pushSystemMessage(pickAgent(names), 'final')
      return
    }

    const wantsWork = payload.work === true
    const workRepo = normalizeWorkRepo(payload.workRepo)
    if (wantsWork && !canDispatchWork(auth, workRepo)) {
      this.pushSystemMessage(workAccessDenied(workRepo), 'final')
      return
    }

    await this.dispatchToAgents(targets, text, {
      work: wantsWork && canDispatchWork(auth, workRepo),
      workRepo,
    })
  }

  private chatHistory() {
    return this.state.messages
      .filter((m) => m.status === 'final' && m.speakerType !== 'system')
      .slice(-24)
      .map((m) => {
        const signals = formatGestureFeedback(parseGestures(m.reactionsJson))
        const content = signals
          ? `${m.speaker}: ${m.body}\n[${signals}]`
          : `${m.speaker}: ${m.body}`
        return {
          role: m.speakerType === 'human' ? 'user' : 'assistant',
          content,
        }
      })
  }

  private async pushAgentReply(
    target: string,
    agentName: string,
    output: string,
    opts: {
      work?: boolean
      workRepo?: string
      /** Reuse id from early pending write so upserts are idempotent across restart. */
      messageId?: string
      status?: ChatMessage['status']
    } = {},
  ) {
    const existingId = opts.messageId
    let reply: ChatMessage | undefined
    if (existingId) {
      for (let i = 0; i < this.state.messages.length; i++) {
        if (this.state.messages[i]?.id === existingId) {
          reply = this.state.messages[i]
          break
        }
      }
    }
    if (!reply) {
      reply = new ChatMessage()
      reply.id = existingId || uid()
      reply.sessionId = this.channelSlug
      reply.speaker = agentName
      reply.speakerType = 'agent'
      reply.agentId = target
      this.pushMessage(reply)
    }
    reply.speaker = agentName
    reply.speakerType = 'agent'
    reply.agentId = target
    reply.body = output
    reply.status = opts.status ?? 'final'
    reply.ts = Date.now()
    if (reply.status === 'final') {
      reply.votePrompt = parseVotePrompt(output, reply.votePrompt)
    }

    recordEvent({
      ts: reply.ts,
      sessionId: this.channelSlug,
      type: 'agent_reply',
      speaker: agentName,
      speakerType: 'agent',
      agentId: target,
      body: output,
      meta: {
        messageId: reply.id,
        channelSlug: this.channelSlug,
        work: opts.work === true,
        workRepo: opts.workRepo,
        status: reply.status,
      },
    })

    // Tracked persist — drainable on dispose/SIGTERM. Await final writes so
    // mid-flight process death still has pending row when status was pending.
    await this.persistMessage({
      id: reply.id,
      speakerId: target,
      speakerName: agentName,
      speakerType: 'agent',
      agentId: target,
      body: output,
      status: reply.status,
      tags: opts.work ? ['work', 'github'] : undefined,
      createdAt: new Date(reply.ts).toISOString(),
      votePrompt: reply.votePrompt || undefined,
    })

    // Accountability: every work-mode agent move lands in ^product with repo context
    if (opts.work && reply.status === 'final') {
      const ghMatch = output.match(/https:\/\/github\.com\/[^\s)]+/i)
      void logAgentWorkToProduct({
        agentId: target,
        agentName,
        title: `Work complete on ${opts.workRepo || 'repo'}`,
        body: output.slice(0, 500),
        repo: opts.workRepo,
        url: ghMatch?.[0],
      })
    }

    return reply
  }

  /**
   * Inject an agent program run (JOHNNY Caddy heal, etc.) into the live room.
   * Called via matchMaker.remoteRoomCall from POST /api/program-events.
   */
  injectProgramEvent(payload: {
    id?: string
    agentId?: string
    speakerName?: string
    body: string
    tags?: string[]
    persist?: boolean
  }): { id: string; channelSlug: string } {
    const agentId = (payload.agentId || 'johnny').toLowerCase()
    const speakerName =
      payload.speakerName ||
      this.state.agents.find((a) => a.id === agentId)?.name ||
      agentId.toUpperCase()
    const msg = new ChatMessage()
    msg.id = payload.id || uid()
    msg.sessionId = this.channelSlug
    msg.speaker = speakerName
    msg.speakerId = `agent:${agentId}`
    msg.speakerType = 'agent'
    msg.agentId = agentId
    msg.body = payload.body
    msg.status = 'final'
    msg.ts = Date.now()
    this.pushMessage(msg)

    recordEvent({
      ts: msg.ts,
      sessionId: this.channelSlug,
      type: 'program_event',
      speaker: speakerName,
      speakerType: 'agent',
      agentId,
      body: payload.body,
      meta: {
        messageId: msg.id,
        channelSlug: this.channelSlug,
        tags: payload.tags ?? ['program'],
      },
    })

    if (payload.persist !== false) {
      void this.persistMessage({
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName,
        speakerType: 'agent',
        agentId,
        body: payload.body,
        status: 'final',
        tags: payload.tags ?? ['program'],
        createdAt: new Date(msg.ts).toISOString(),
      })
    }

    if (payload.body?.trim()) {
      conversationSearchIndex.indexDocument({
        key: `${this.channelSlug}::${msg.id}`,
        messageId: msg.id,
        sessionId: this.channelSlug,
        kind: 'channel',
        channelSlug: this.channelSlug,
        speaker: speakerName,
        speakerType: 'agent',
        agentId,
        body: payload.body,
        ts: msg.ts,
      })
      conversationSearchIndex.markReady()
    }

    return { id: msg.id, channelSlug: this.channelSlug }
  }

  private async dispatchToAgents(
    targets: string[],
    text: string,
    opts: { work?: boolean; workRepo?: string } = {},
  ) {
    const workRepo = opts.workRepo ?? normalizeWorkRepo()
    const agentNames = targets.map((t) => this.state.agents.find((a) => a.id === t)?.name ?? t)
    const statusMsg = this.pushSystemMessage(
      opts.work
        ? puttingOnWork(agentNames, workRepo)
        : targets.length === 1
          ? handingToAgent(agentNames[0])
          : askingFleet(agentNames),
      'pending',
    )

    const history = this.chatHistory()
    statusMsg.body = agentThinking(agentNames.join(', '))
    statusMsg.ts = Date.now()

    for (const target of targets) {
      const agentRow = this.state.agents.find((a) => a.id === target)
      if (agentRow) agentRow.status = 'thinking'
    }

    // Early pending rows in Postgres so a restart mid-dispatch still shows the turn.
    const pendingIds = new Map<string, string>()
    await Promise.all(
      targets.map(async (target) => {
        const agentName = this.state.agents.find((a) => a.id === target)?.name ?? target
        const id = uid()
        pendingIds.set(target, id)
        const pending = new ChatMessage()
        pending.id = id
        pending.sessionId = this.channelSlug
        pending.speaker = agentName
        pending.speakerType = 'agent'
        pending.agentId = target
        pending.body = '…'
        pending.status = 'pending'
        pending.ts = Date.now()
        this.pushMessage(pending)
        await this.persistMessage({
          id,
          speakerId: target,
          speakerName: agentName,
          speakerType: 'agent',
          agentId: target,
          body: '…',
          status: 'pending',
          tags: opts.work ? ['work', 'github'] : undefined,
          createdAt: new Date(pending.ts).toISOString(),
        })
      }),
    )

    const results = await Promise.allSettled(
      targets.map(async (target) => {
        const agentName = this.state.agents.find((a) => a.id === target)?.name ?? target
        const res = opts.work
          ? await dispatchAgentWork(target, text, history, workRepo)
          : await dispatchAgentChat(target, text, history, {
              personalAgent: false,
              channelSlug: this.channelSlug,
            })
        return { target, agentName, res }
      }),
    )

    this.removeMessageById(statusMsg.id)

    for (let i = 0; i < results.length; i++) {
      const target = targets[i]
      const agentRow = this.state.agents.find((a) => a.id === target)
      if (agentRow) agentRow.status = 'idle'

      const result = results[i]
      const workMeta = {
        work: opts.work === true,
        workRepo,
        messageId: pendingIds.get(target),
      }
      if (result.status === 'fulfilled') {
        await this.pushAgentReply(
          target,
          result.value.agentName,
          result.value.res.output,
          { ...workMeta, status: 'final' },
        )
      } else {
        const agentName = agentRow?.name ?? target
        const reason = result.reason
        const is429 =
          reason instanceof Error &&
          (reason.message.includes('429') || reason.name === 'OpenRouterRateLimitError')
        await this.pushAgentReply(
          target,
          agentName,
          is429
            ? fleetRateLimited(agentName)
            : reason instanceof Error
              ? reason.message
              : 'Agent failed',
          { ...workMeta, status: 'error' },
        )
      }
    }
  }

  private seatIncomingAgents(text: string, payload: ChatPayload) {
    const seated = [...this.state.agents].map((a) => ({
      id: a.id,
      name: a.name,
    }))
    ensureAgentsInRoster(this.state, [
      ...(payload.agentIds ?? []),
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
}
