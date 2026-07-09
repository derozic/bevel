export type SchemaMessage = {
  id: string
  speaker: string
  speakerId?: string
  speakerAvatar?: string
  speakerType: string
  agentId?: string
  body: string
  status: string
  ts: number
}

export type ChatMsg = {
  id: string
  speaker: string
  speakerId?: string
  speakerAvatar?: string
  speakerType: string
  agentId?: string
  body: string
  status: string
  ts: number
}

export type HumanParticipant = {
  clientId: string
  userId: string
  name: string
  avatar?: string
}

export function isValidSchemaMessage(m: unknown): m is SchemaMessage {
  return (
    !!m &&
    typeof m === 'object' &&
    typeof (m as SchemaMessage).id === 'string' &&
    (m as SchemaMessage).id.length > 0
  )
}

export function dedupeMessagesById(messages: ChatMsg[]): ChatMsg[] {
  const byId = new Map<string, ChatMsg>()
  for (const m of messages) {
    if (!m.id) continue
    byId.set(m.id, m)
  }
  return [...byId.values()].sort((a, b) => a.ts - b.ts)
}

export function readSchemaMessages(
  messages?: { length: number; [index: number]: SchemaMessage } | null
): ChatMsg[] {
  if (!messages || typeof messages.length !== 'number') return []
  const list: ChatMsg[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (!isValidSchemaMessage(m)) continue
    list.push(toChatMsg(m))
  }
  return dedupeMessagesById(list)
}

export function toChatMsg(m: SchemaMessage): ChatMsg {
  return {
    id: m.id,
    speaker: m.speaker,
    speakerId: m.speakerId || undefined,
    speakerAvatar: m.speakerAvatar || undefined,
    speakerType: m.speakerType,
    agentId: m.agentId || undefined,
    body: m.body,
    status: m.status,
    ts: m.ts,
  }
}

/** One avatar per signed-in user — Colyseus tracks connections (clientId), not people. */
export function dedupeHumanParticipantsByUser(
  participants: HumanParticipant[]
): HumanParticipant[] {
  const byClient = new Map<string, HumanParticipant>()
  for (const p of participants) {
    const clientKey = p.clientId?.trim()
    if (!clientKey) continue
    byClient.set(clientKey, p)
  }

  const byUser = new Map<string, HumanParticipant>()
  for (const p of byClient.values()) {
    const userKey = p.userId?.trim() || p.clientId
    if (!userKey) continue
    byUser.set(userKey, p)
  }
  return [...byUser.values()]
}

export function readHumanParticipants(
  humans?: { length: number; [index: number]: HumanParticipant } | null
): HumanParticipant[] {
  if (!humans || typeof humans.length !== 'number') return []
  const list: HumanParticipant[] = []
  for (let i = 0; i < humans.length; i++) {
    const h = humans[i]
    if (!h?.clientId) continue
    list.push({
      clientId: h.clientId,
      userId: h.userId,
      name: h.name,
      avatar: h.avatar || undefined,
    })
  }
  return dedupeHumanParticipantsByUser(list)
}