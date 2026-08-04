import { DEFAULT_CHANNELS, type FleetChannelSummary } from '@/lib/fleet-channels'

const ORDER_STORAGE_KEY = 'bevel-channel-order'
const CHANNELS_STORAGE_KEY = 'bevel-channel-list'

let channelCache: FleetChannelSummary[] = []

function persistChannelList(list: FleetChannelSummary[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore quota / private mode
  }
}

function readPersistedChannelList(): FleetChannelSummary[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CHANNELS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (c): c is FleetChannelSummary =>
          !!c &&
          typeof c === 'object' &&
          typeof (c as FleetChannelSummary).slug === 'string',
      )
      .map((c) => ({
        slug: String(c.slug).toLowerCase(),
        name: String(c.name || c.slug),
        tags: Array.isArray(c.tags) ? c.tags.map(String) : ['bevel'],
      }))
  } catch {
    return []
  }
}

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
 *
 * Prev-only channels (e.g. just created client-side while GET still returns
 * defaults) are kept so create does not disappear on the next silent reload.
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
    if (next) {
      synced.push(next)
      nextBySlug.delete(item.slug)
    } else {
      // Keep client-known channels the server list omitted
      synced.push(item)
    }
  }

  const novel = sortChannelsStable([...nextBySlug.values()])
  const merged = [...synced, ...novel]
  if (merged.length > 0) {
    persistChannelOrder(merged.map((c) => c.slug))
    persistChannelList(merged)
    channelCache = merged
  }
  return merged
}

/**
 * In-memory only — safe during SSR / first client paint.
 * Do not read localStorage here (causes React hydration #418).
 */
export function readChannelCache(): FleetChannelSummary[] {
  return channelCache
}

/**
 * Seed memory from props/defaults only — no session/local storage
 * (those run in hydrateChannelCacheFromStorage after mount).
 */
export function seedChannelCache(list: FleetChannelSummary[]): FleetChannelSummary[] {
  const base = list.length > 0 ? list : DEFAULT_CHANNELS
  // Stable slug order only — sessionStorage order would diverge SSR vs client (#418)
  const ordered = sortChannelsStable(base)
  channelCache = ordered
  return ordered
}

/** Client-only: merge localStorage custom channels after hydration. */
export function hydrateChannelCacheFromStorage(
  serverList?: FleetChannelSummary[],
): FleetChannelSummary[] {
  if (typeof window === 'undefined') {
    return channelCache.length > 0 ? channelCache : DEFAULT_CHANNELS
  }
  const persisted = readPersistedChannelList()
  const base =
    serverList && serverList.length > 0
      ? serverList
      : channelCache.length > 0
        ? channelCache
        : DEFAULT_CHANNELS
  if (persisted.length === 0) {
    return syncChannelData(base, base)
  }
  return syncChannelData(persisted, base)
}