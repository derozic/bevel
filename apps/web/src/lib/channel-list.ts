import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'

const ORDER_STORAGE_KEY = 'bevel-channel-order'

let channelCache: FleetChannelSummary[] = []

export function sortChannelsStable(list: FleetChannelSummary[]): FleetChannelSummary[] {
  return [...list].sort((a, b) => a.slug.localeCompare(b.slug))
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

export function persistChannelOrder(slugs: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(slugs))
  } catch {
    // ignore quota / private mode
  }
}

export function applyPersistedChannelOrder(
  list: FleetChannelSummary[]
): FleetChannelSummary[] {
  if (list.length === 0) return []

  const order = readPersistedOrder()
  if (order.length === 0) return sortChannelsStable(list)

  const bySlug = new Map(list.map((c) => [c.slug, c]))
  const ordered: FleetChannelSummary[] = []
  const seen = new Set<string>()

  for (const slug of order) {
    const item = bySlug.get(slug)
    if (!item) continue
    ordered.push(item)
    seen.add(slug)
  }

  const novel = sortChannelsStable(list.filter((c) => !seen.has(c.slug)))
  return [...ordered, ...novel]
}

/**
 * Refresh channel fields without reordering existing rows.
 * New channels are appended at the end in stable slug order.
 */
export function syncChannelData(
  prev: FleetChannelSummary[],
  incoming: FleetChannelSummary[]
): FleetChannelSummary[] {
  const nextList = incoming.length > 0 ? incoming : DEFAULT_CHANNELS
  const nextBySlug = new Map(nextList.map((c) => [c.slug, c]))

  const synced: FleetChannelSummary[] = []
  for (const item of prev) {
    const next = nextBySlug.get(item.slug)
    if (!next) continue
    synced.push(next)
    nextBySlug.delete(item.slug)
  }

  const novel = sortChannelsStable([...nextBySlug.values()])
  const merged = [...synced, ...novel]
  if (merged.length > 0) {
    persistChannelOrder(merged.map((c) => c.slug))
    channelCache = merged
  }
  return merged
}

export function readChannelCache(): FleetChannelSummary[] {
  return channelCache
}

export function seedChannelCache(list: FleetChannelSummary[]): FleetChannelSummary[] {
  const ordered = applyPersistedChannelOrder(
    list.length > 0 ? list : DEFAULT_CHANNELS
  )
  channelCache = ordered
  return ordered
}