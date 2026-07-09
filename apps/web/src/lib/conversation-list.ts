import type { SessionSummary } from '@/lib/realtime'

const ORDER_STORAGE_KEY = 'bevel-direct-conversation-order'

/** In-memory order survives BevelRail remounts between route navigations. */
let conversationCache: SessionSummary[] = []

export function filterVisibleSessions(list: SessionSummary[]): SessionSummary[] {
  return list.filter((s) => s.messageCount > 0 || s.preview)
}

/** Deterministic order — never changes when previews or updatedAt change. */
export function sortSessionsStable(list: SessionSummary[]): SessionSummary[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.sessionId.localeCompare(b.sessionId)
  })
}

function readPersistedOrder(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

export function persistConversationOrder(sessionIds: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(sessionIds))
  } catch {
    // ignore quota / private mode
  }
}

export function applyPersistedOrder(list: SessionSummary[]): SessionSummary[] {
  const visible = filterVisibleSessions(list)
  if (visible.length === 0) return []

  const order = readPersistedOrder()
  if (order.length === 0) return sortSessionsStable(visible)

  const byId = new Map(visible.map((s) => [s.sessionId, s]))
  const ordered: SessionSummary[] = []
  const seen = new Set<string>()

  for (const id of order) {
    const item = byId.get(id)
    if (!item) continue
    ordered.push(item)
    seen.add(id)
  }

  const novel = sortSessionsStable(visible.filter((s) => !seen.has(s.sessionId)))
  return [...ordered, ...novel]
}

/**
 * Refresh session fields without reordering existing rows.
 * Brand-new sessions are appended at the end in stable order.
 */
export function syncConversationData(
  prev: SessionSummary[],
  incoming: SessionSummary[]
): SessionSummary[] {
  const nextVisible = filterVisibleSessions(incoming)
  const nextById = new Map(nextVisible.map((s) => [s.sessionId, s]))

  const synced: SessionSummary[] = []
  const seen = new Set<string>()

  for (const item of prev) {
    const next = nextById.get(item.sessionId)
    if (!next) continue
    synced.push(next)
    seen.add(item.sessionId)
    nextById.delete(item.sessionId)
  }

  const novel = sortSessionsStable([...nextById.values()])
  const merged = [...synced, ...novel]
  if (merged.length > 0) {
    persistConversationOrder(merged.map((s) => s.sessionId))
    conversationCache = merged
  }
  return merged
}

export function readConversationCache(): SessionSummary[] {
  return conversationCache
}

export function seedConversationCache(list: SessionSummary[]): SessionSummary[] {
  const ordered = applyPersistedOrder(list)
  conversationCache = ordered
  return ordered
}