/** Public /health occupancy — no room ids, no metadata. */

export type RoomListingLike = {
  name?: string
  clients?: number
  metadata?: {
    humans?: number
    reconnecting?: number
  }
}

export type RoomNameOccupancy = {
  rooms: number
  clients: number
  humans: number
  reconnecting: number
}

export type RoomOccupancy = {
  count: number
  clients: number
  humans: number
  reconnecting: number
  byName: Record<string, RoomNameOccupancy>
}

function metaCount(
  listing: RoomListingLike,
  key: 'humans' | 'reconnecting',
): number {
  const value = listing.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function summarizeRooms(listings: RoomListingLike[]): RoomOccupancy {
  const byName: Record<string, RoomNameOccupancy> = {}
  let clients = 0
  let humans = 0
  let reconnecting = 0
  for (const listing of listings) {
    const name =
      typeof listing.name === 'string' && listing.name.length > 0
        ? listing.name
        : 'unknown'
    const n = Number(listing.clients) || 0
    const h = metaCount(listing, 'humans')
    const r = metaCount(listing, 'reconnecting')
    clients += n
    humans += h
    reconnecting += r
    const bucket = byName[name] ?? { rooms: 0, clients: 0, humans: 0, reconnecting: 0 }
    bucket.rooms += 1
    bucket.clients += n
    bucket.humans += h
    bucket.reconnecting += r
    byName[name] = bucket
  }
  return { count: listings.length, clients, humans, reconnecting, byName }
}
