import { Client, Room, ServerError } from 'colyseus'
import { verifyAuthToken } from '../auth-verify.js'
import { dispatchAgentChat, dispatchAgentWork, sanitizeAgentError } from '../agent-dispatch.js'
import { canDispatchWork, normalizeWorkRepo } from '../work-repos.js'
import {
  addChannelAgentMember,
  appendChannelMessage,
  fetchChannel,
  fetchChannelMessages,
} from '../fleet-channel-api.js'
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
  agentNotInChannel,
  agentThinking,
  askingFleet,
  channelMemberJoined,
  handingToAgent,
  pickAgent,
  puttingOnWork,
  workAccessDenied,
} from '../system-voice.js'

/** Cap live Colyseus state so Encoder never overflows mid-thread. */
const LIVE_MESSAGE_CAP = 120
/** History hydrate into shared state (full archive still on REST). */
const HISTORY_HYDRATE_LIMIT = 40

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
  /** Single target (1:1 sessions / legacy). */
  targetAgent?: string
  /** Multi-target from client @mentions / roster. */
  targetAgents?: string[]
  work?: boolean
  workRepo?: string
}

type ResolveTargetsResult = {
  targets: string[]
  /** @tokens that look like agents but are not channel members (after auto-add attempt). */
  blocked: string[]
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.toLowerCase().trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** All @tokens in text (lowercase). */
function parseAtTokens(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(/@([a-z0-9_-]+)\b/gi)) {
    if (m[1]) found.push(m[1].toLowerCase())
  }
  return uniqueIds(found)
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
  /** Channel membership ACL — only these agents may be @mentioned / dispatched. */
  private memberAgentIds = new Set<string>()

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
    // ACL: membership roster is source of truth; join options can only narrow it.
    const memberIds = (
      channel?.agentIds?.length
        ? channel.agentIds
        : channel?.defaultAgentIds ?? ['hermes', 'johnny']
    ).map((id) => id.toLowerCase())
    const requested = (options.agentIds ?? []).map((id) => id.toLowerCase())
    const agentIds = (
      requested.length
        ? requested.filter((id) => memberIds.includes(id))
        : memberIds
    )
    // Remember full ACL for mention authorization
    this.memberAgentIds = new Set(memberIds)

    this.state.title = channel?.name ?? `~${this.channelSlug}`
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

    const history = await fetchChannelMessages(this.channelSlug, HISTORY_HYDRATE_LIMIT)
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
    while (this.state.messages.length >= LIVE_MESSAGE_CAP) {
      this.state.messages.shift()
    }
    this.state.messages.push(msg)
  }

  /** Ensure agent is on live presence roster (after membership auto-add). */
  private ensureAgentPresence(agentId: string) {
    const id = agentId.toLowerCase()
    if (this.state.agentIds.includes(id)) return
    this.state.agentIds.push(id)
    const catalog = loadMergedRegistry()
    const meta = catalog.find((a) => a.id === id)
    const row = new AgentPresence()
    row.id = id
    row.name = meta?.name ?? id
    row.accent = meta?.accent ?? '#1a1410'
    row.source = meta?.federated ? 'federated' : 'fleet'
    this.state.agents.push(row)
  }

  private isKnownCatalogAgent(id: string): boolean {
    const key = id.toLowerCase()
    return loadMergedRegistry().some(
      (a) => a.id.toLowerCase() === key || a.name.toLowerCase() === key,
    )
  }

  private catalogIdForToken(token: string): string | null {
    const key = token.toLowerCase()
    const hit = loadMergedRegistry().find(
      (a) => a.id.toLowerCase() === key || a.name.toLowerCase() === key,
    )
    return hit?.id.toLowerCase() ?? null
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

    // Auto-add catalog agents that were @mentioned but not yet channel members.
    await this.autoAddMentionedMembers(text, payload)

    let { targets, blocked } = this.resolveTargetAgents(text, payload)
    if (targets.length === 0) {
      const names = this.state.agents.map((a) => a.name)
      const memberList = [...this.memberAgentIds]
      const body =
        blocked.length > 0
          ? agentNotInChannel(blocked, memberList)
          : pickAgent(names)
      this.pushSystemMessage(body, 'final')
      void appendChannelMessage(this.channelSlug, {
        id: uid(),
        speakerId: 'system',
        speakerName: SYSTEM_SPEAKER,
        speakerType: 'system',
        body,
        status: 'final',
      })
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

  /**
   * When the user @mentions a known catalog agent not on the ACL, invite them
   * into the channel (Buzz/Slack “bots as members” pattern) then dispatch.
   */
  private async autoAddMentionedMembers(text: string, payload: ChatPayload) {
    const tokens = uniqueIds([
      ...parseAtTokens(text),
      ...(payload.targetAgents ?? []).map((id) => id.toLowerCase()),
      ...(payload.targetAgent ? [payload.targetAgent.toLowerCase()] : []),
    ])
    for (const token of tokens) {
      const catalogId = this.catalogIdForToken(token) ?? token
      if (this.memberAgentIds.has(catalogId)) continue
      if (!this.isKnownCatalogAgent(catalogId) && !this.isKnownCatalogAgent(token)) {
        continue
      }
      const ok = await addChannelAgentMember(this.channelSlug, catalogId, 'mention')
      if (ok) {
        this.memberAgentIds.add(catalogId)
        this.ensureAgentPresence(catalogId)
        console.log(
          `[fleet-channel] auto-added @${catalogId} to ~${this.channelSlug} via @mention`,
        )
      }
    }
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
    opts: {
      work?: boolean
      workRepo?: string
      phase?: string
      errorCode?: string
    } = {},
  ) {
    const reply = new ChatMessage()
    reply.id = uid()
    reply.sessionId = this.channelSlug
    reply.speaker = agentName
    reply.speakerType = 'agent'
    reply.agentId = target
    reply.body = output
    reply.status = opts.phase === 'error' ? 'error' : 'final'
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
        phase: opts.phase,
        errorCode: opts.errorCode,
      },
    })

    void appendChannelMessage(this.channelSlug, {
      id: reply.id,
      speakerId: target,
      speakerName: agentName,
      speakerType: 'agent',
      agentId: target,
      body: output,
      status: opts.phase === 'error' ? 'error' : 'final',
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

    const traceRoom = {
      roomKind: 'channel' as const,
      roomId: this.channelSlug,
    }

    const results = await Promise.allSettled(
      targets.map(async (target) => {
        const agentName = this.state.agents.find((a) => a.id === target)?.name ?? target
        const res = opts.work
          ? await dispatchAgentWork(target, text, history, workRepo, {
              trace: { ...traceRoom, agentId: target },
            })
          : await dispatchAgentChat(target, text, history, {
              trace: { ...traceRoom, agentId: target },
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
        const sanitized = sanitizeAgentError(agentName, result.reason)
        this.pushAgentReply(target, agentName, sanitized.publicMessage, {
          ...workMeta,
          phase: 'error',
          errorCode: sanitized.code,
        })
      }
    }
  }

  private resolveTargetAgents(text: string, payload: ChatPayload): ResolveTargetsResult {
    // ACL: must be a channel member. Live session roster may be a subset for UX.
    const allowed = (id: string) => {
      const key = id.toLowerCase()
      if (this.memberAgentIds.size > 0 && !this.memberAgentIds.has(key)) return false
      return this.state.agentIds.includes(key) || this.memberAgentIds.has(key)
    }

    const normalizeToken = (token: string): string => {
      return this.catalogIdForToken(token) ?? token.toLowerCase()
    }

    const explicitList = uniqueIds([
      ...(payload.targetAgents ?? []),
      ...(payload.targetAgent ? [payload.targetAgent] : []),
    ]).map(normalizeToken)

    if (explicitList.length > 0) {
      const targets = explicitList.filter((id) => allowed(id))
      const blocked = explicitList.filter(
        (id) => !allowed(id) && this.isKnownCatalogAgent(id),
      )
      return { targets, blocked }
    }

    const mentionTokens = parseAtTokens(text).map(normalizeToken)
    if (mentionTokens.length > 0) {
      const targets = mentionTokens.filter((id) => allowed(id))
      const blocked = mentionTokens.filter(
        (id) => !allowed(id) && this.isKnownCatalogAgent(id),
      )
      // Also catch name-only tokens that aren't catalog (people) — ignore as blocked
      return { targets, blocked }
    }

    if (this.state.agentIds.length === 1 && allowed(this.state.agentIds[0])) {
      return { targets: [this.state.agentIds[0]], blocked: [] }
    }

    const lower = text.toLowerCase()
    const nameHits: string[] = []
    for (const agent of this.state.agents) {
      if (
        allowed(agent.id) &&
        (lower.includes(`@${agent.id}`) ||
          new RegExp(`\\b${agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
            text,
          ))
      ) {
        nameHits.push(agent.id)
      }
    }
    if (nameHits.length > 0) {
      return { targets: uniqueIds(nameHits), blocked: [] }
    }

    // No explicit target: agents currently in the live roster who are members
    return {
      targets: this.state.agentIds.filter((id) => allowed(id)),
      blocked: [],
    }
  }
}