/** Sidebar keys for a live agent turn. Shared by realtime and the web rail. */

export type IntelligenceKind = 'talk' | 'channel' | 'session'

export function intelligenceKey(kind: IntelligenceKind, id: string): string {
  const clean = id.trim().toLowerCase()
  return clean ? `${kind}:${clean}` : ''
}

/** Keys that should light while these agents are in a turn. */
export function intelligenceKeysForTurn(input: {
  sessionId?: string
  channelSlug?: string
  agentIds: readonly string[]
}): string[] {
  const keys: string[] = []
  if (input.channelSlug) {
    const key = intelligenceKey('channel', input.channelSlug)
    if (key) keys.push(key)
  }
  if (input.sessionId) {
    const key = intelligenceKey('session', input.sessionId)
    if (key) keys.push(key)
  }
  for (const id of input.agentIds) {
    const key = intelligenceKey('talk', id)
    if (key) keys.push(key)
  }
  return [...new Set(keys)]
}

/** True when this rail row is one of the conversations currently working. */
export function turnTouches(
  keys: ReadonlySet<string>,
  probe: {
    agentId?: string
    agentIds?: readonly string[]
    channelSlug?: string
    sessionId?: string
  },
): boolean {
  if (probe.agentId && keys.has(intelligenceKey('talk', probe.agentId))) return true
  if (probe.channelSlug && keys.has(intelligenceKey('channel', probe.channelSlug))) return true
  if (probe.sessionId && keys.has(intelligenceKey('session', probe.sessionId))) return true
  for (const id of probe.agentIds ?? []) {
    if (keys.has(intelligenceKey('talk', id))) return true
  }
  return false
}
