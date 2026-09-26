/**
 * In-process refcount of conversations with a live agent turn.
 * FleetLobby mirrors transitions onto its schema so every rail can see them.
 *
 * Key format matches packages/schema/src/intelligence.ts
 * (talk|channel|session + ":" + lowercase id).
 */

export function intelligenceKey(kind: 'talk' | 'channel' | 'session', id: string): string {
  const clean = id.trim().toLowerCase()
  return clean ? `${kind}:${clean}` : ''
}

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

export type IntelligenceEvent = {
  phase: 'working' | 'idle'
  keys: string[]
}

type Listener = (event: IntelligenceEvent) => void

const counts = new Map<string, number>()
const listeners = new Set<Listener>()

export function workingSnapshot(): string[] {
  return [...counts.keys()]
}

export function subscribeIntelligence(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(event: IntelligenceEvent) {
  if (event.keys.length === 0) return
  for (const listener of listeners) listener(event)
}

export function markWorking(keys: readonly string[]): void {
  const started: string[] = []
  for (const key of keys) {
    if (!key) continue
    const next = (counts.get(key) ?? 0) + 1
    counts.set(key, next)
    if (next === 1) started.push(key)
  }
  emit({ phase: 'working', keys: started })
}

export function markIdle(keys: readonly string[]): void {
  const stopped: string[] = []
  for (const key of keys) {
    if (!key) continue
    const next = (counts.get(key) ?? 0) - 1
    if (next <= 0) {
      counts.delete(key)
      stopped.push(key)
    } else {
      counts.set(key, next)
    }
  }
  emit({ phase: 'idle', keys: stopped })
}

/** Test-only. Drops counts and listeners. */
export function resetIntelligence(): void {
  counts.clear()
  listeners.clear()
}
