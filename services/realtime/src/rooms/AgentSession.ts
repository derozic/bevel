import { Client, Room, ServerError } from 'colyseus'
import { verifyAuthToken } from '../auth-verify.js'
import { dispatchAgentChat } from '../agent-dispatch.js'
import { recordEvent } from '../recording.js'
import { loadMergedRegistry } from '../registry-merge.js'
import {
  AgentPresence,
  AgentSessionState,
  ChatMessage,
  HumanPresence,
} from '../schema/ChatState.js'
import { BEVEL_POWERED_BY_LABEL } from '../product/bevel.js'
import { removeHumansByUserId } from '../human-presence.js'
import {
  SYSTEM_SPEAKER,
  agentThinking,
  askingFleet,
  fleetRateLimited,
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

type ChatPayload = {
  text: string
  speaker?: string
  targetAgent?: string
}

function uid(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class AgentSession extends Room {
  maxClients = 32
  declare state: AgentSessionState
  private speakerNames = new Map<string, string>()
  private speakerProfiles = new Map<string, SpeakerProfile>()

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

  onCreate(options: JoinOptions) {
    this.setState(new AgentSessionState())
    const sessionId = options.sessionId ?? this.roomId
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

    const agentNames = this.state.agents.map((a) => a.name)
    this.pushSystemMessage(sessionWelcome(agentNames), 'final')

    recordEvent({
      ts: Date.now(),
      sessionId,
      type: 'status',
      speaker: SYSTEM_SPEAKER,
      speakerType: 'system',
      body: sessionWelcome(agentNames),
      meta: { title: this.state.title, agentIds: ids },
    })

    this.onMessage('chat', (client, payload: ChatPayload) => {
      void this.handleChat(client.sessionId, payload)
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
    })

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
      .map((m) => ({
        role: m.speakerType === 'human' ? 'user' : 'assistant',
        content: m.body,
      }))
  }

  private pushAgentReply(target: string, agentName: string, output: string, meta?: Record<string, unknown>) {
    const reply = new ChatMessage()
    reply.id = uid()
    reply.sessionId = this.state.sessionId
    reply.speaker = agentName
    reply.speakerType = 'agent'
    reply.agentId = target
    reply.body = output
    reply.status = 'final'
    reply.ts = Date.now()
    this.pushMessage(reply)

    recordEvent({
      ts: reply.ts,
      sessionId: this.state.sessionId,
      type: 'agent_reply',
      speaker: reply.speaker,
      speakerType: 'agent',
      agentId: target,
      body: output,
      meta,
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
        const res = await dispatchAgentChat(target, text, history)
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
        const reason = result.reason
        const is429 =
          (reason instanceof Error &&
            (reason.message.includes('429') ||
              reason.message.includes('rate limit') ||
              reason.name === 'OpenRouterRateLimitError')) ||
          false
        const errBody = is429
          ? fleetRateLimited(agentName)
          : reason instanceof Error
            ? reason.message
            : 'Agent failed'
        this.pushAgentReply(target, agentName, errBody, {
          phase: 'error',
          rateLimited: is429,
        })
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

    const lower = text.toLowerCase()
    for (const agent of this.state.agents) {
      const id = agent.id.toLowerCase()
      const name = agent.name.toLowerCase()
      if (
        lower.includes(`@${id}`) ||
        new RegExp(`\\b${id}\\b`, 'i').test(text) ||
        new RegExp(`\\b${name}\\b`, 'i').test(text)
      ) {
        return [id]
      }
    }

    if (this.state.agentIds.length === 1) return [this.state.agentIds[0]]

    return [...this.state.agentIds]
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