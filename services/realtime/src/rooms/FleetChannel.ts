import { Client, Room, ServerError } from 'colyseus'
import { verifyAuthToken } from '../auth-verify.js'
import { dispatchAgentChat, dispatchAgentWork } from '../agent-dispatch.js'
import { canDispatchWork, normalizeWorkRepo } from '../work-repos.js'
import { appendChannelMessage, fetchChannel, fetchChannelMessages } from '../fleet-channel-api.js'
import { logAgentWorkToProduct } from '../product-log.js'
import { BEVEL_POWERED_BY_LABEL } from '../product/bevel.js'
import { recordEvent } from '../recording.js'
import { conversationSearchIndex } from '../search-index.js'
import { loadMergedRegistry } from '../registry-merge.js'
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
  work?: boolean
  workRepo?: string
}

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

export class FleetChannel extends Room {
  maxClients = 32
  declare state: FleetChannelState
  private channelSlug = 'general'
  private speakerNames = new Map<string, string>()
  private speakerProfiles = new Map<string, SpeakerProfile>()

  static async onAuth(token: string, options: JoinOptions): Promise<AuthPayload> {
    const authToken = token || options.authToken
    if (!authToken) throw new ServerError(401, 'Sign in required')
    const claims = await verifyAuthToken(authToken)
    if (!claims) throw new ServerError(401, 'Invalid or expired session')
    return claims
  }

  async onCreate(options: JoinOptions) {
    this.setState(new FleetChannelState())
    this.channelSlug = (options.channelSlug ?? 'general').toLowerCase()
    this.state.channelSlug = this.channelSlug
    this.state.createdAt = Date.now()
    this.state.status = 'active'
    this.state.poweredByLabel = BEVEL_POWERED_BY_LABEL

    const channel = await fetchChannel(this.channelSlug)
    const agentIds = (
      options.agentIds?.length
        ? options.agentIds
        : channel?.defaultAgentIds ?? ['hermes', 'johnny']
    ).map((id) => id.toLowerCase())

    this.state.title = channel?.name ?? `^${this.channelSlug}`
    for (const tag of channel?.tags ?? []) {
      this.state.tags.push(tag)
    }

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

    const history = await fetchChannelMessages(this.channelSlug, 100)
    for (const row of history) {
      const msg = new ChatMessage()
      msg.id = row.id
      msg.sessionId = this.channelSlug
      msg.speaker = row.speakerName
      msg.speakerId = row.speakerId
      msg.speakerAvatar = row.speakerAvatar ?? ''
      msg.speakerType = row.speakerType
      msg.agentId = row.agentId ?? ''
      msg.body = row.body
      msg.status = row.status
      msg.ts = new Date(row.createdAt).getTime() || Date.now()
      this.pushMessage(msg)
      // Seed search index only (do not re-append history into JSONL)
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

    // Channel copy lives in the client empty state — avoid welcome/join/leave chat noise.

    this.onMessage('chat', (client, payload: ChatPayload) => {
      void this.handleChat(client, payload)
    })
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

    void appendChannelMessage(this.channelSlug, {
      id: human.id,
      speakerId: human.speakerId,
      speakerName: human.speaker,
      speakerAvatar: human.speakerAvatar || undefined,
      speakerType: 'human',
      body: text,
      status: 'final',
      tags,
    })

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
      .map((m) => ({
        role: m.speakerType === 'human' ? 'user' : 'assistant',
        content: `${m.speaker}: ${m.body}`,
      }))
  }

  private pushAgentReply(
    target: string,
    agentName: string,
    output: string,
    opts: { work?: boolean; workRepo?: string } = {},
  ) {
    const reply = new ChatMessage()
    reply.id = uid()
    reply.sessionId = this.channelSlug
    reply.speaker = agentName
    reply.speakerType = 'agent'
    reply.agentId = target
    reply.body = output
    reply.status = 'final'
    reply.ts = Date.now()
    this.pushMessage(reply)

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
      },
    })

    void appendChannelMessage(this.channelSlug, {
      id: reply.id,
      speakerId: target,
      speakerName: agentName,
      speakerType: 'agent',
      agentId: target,
      body: output,
      status: 'final',
      tags: opts.work ? ['work', 'github'] : undefined,
    })

    // Accountability: every work-mode agent move lands in ^product with repo context
    if (opts.work) {
      const ghMatch = output.match(
        /https:\/\/github\.com\/[^\s)]+/i,
      )
      void logAgentWorkToProduct({
        agentId: target,
        agentName,
        title: `Work complete on ${opts.workRepo || 'repo'}`,
        body: output.slice(0, 500),
        repo: opts.workRepo,
        url: ghMatch?.[0],
      })
    }
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
      void appendChannelMessage(this.channelSlug, {
        id: msg.id,
        speakerId: msg.speakerId,
        speakerName,
        speakerType: 'agent',
        agentId,
        body: payload.body,
        status: 'final',
        tags: payload.tags ?? ['program'],
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
    opts: { work?: boolean; workRepo?: string } = {}
  ) {
    const workRepo = opts.workRepo ?? normalizeWorkRepo()
    const agentNames = targets.map((t) => this.state.agents.find((a) => a.id === t)?.name ?? t)
    const statusMsg = this.pushSystemMessage(
      opts.work
        ? puttingOnWork(agentNames, workRepo)
        : targets.length === 1
          ? handingToAgent(agentNames[0])
          : askingFleet(agentNames),
      'pending'
    )

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
        const res = opts.work
          ? await dispatchAgentWork(target, text, history, workRepo)
          : await dispatchAgentChat(target, text, history)
        return { target, agentName, res }
      })
    )

    this.removeMessageById(statusMsg.id)

    for (let i = 0; i < results.length; i++) {
      const target = targets[i]
      const agentRow = this.state.agents.find((a) => a.id === target)
      if (agentRow) agentRow.status = 'idle'

      const result = results[i]
      const workMeta = { work: opts.work === true, workRepo }
      if (result.status === 'fulfilled') {
        this.pushAgentReply(
          target,
          result.value.agentName,
          result.value.res.output,
          workMeta,
        )
      } else {
        const agentName = agentRow?.name ?? target
        const reason = result.reason
        const is429 =
          reason instanceof Error &&
          (reason.message.includes('429') || reason.name === 'OpenRouterRateLimitError')
        this.pushAgentReply(
          target,
          agentName,
          is429
            ? fleetRateLimited(agentName)
            : reason instanceof Error
              ? reason.message
              : 'Agent failed',
          workMeta,
        )
      }
    }
  }

  private resolveTargetAgents(text: string, explicit?: string): string[] {
    const inSession = (id: string) => this.state.agentIds.includes(id)
    if (explicit) {
      const id = explicit.toLowerCase()
      return inSession(id) ? [id] : []
    }
    const mention = text.match(/@([a-z0-9_-]+)\b/i)
    if (mention) {
      const id = mention[1].toLowerCase()
      return inSession(id) ? [id] : []
    }
    if (this.state.agentIds.length === 1) return [this.state.agentIds[0]]
    const lower = text.toLowerCase()
    for (const agent of this.state.agents) {
      if (lower.includes(`@${agent.id}`) || lower.includes(agent.name.toLowerCase())) {
        return [agent.id]
      }
    }
    return [...this.state.agentIds]
  }
}