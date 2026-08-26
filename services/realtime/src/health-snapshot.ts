/** Public /health occupancy — no room ids, no metadata. */

export type RoomListingLike = {
  name?: string
  clients?: number
}

export type RoomOccupancy = {
  count: number
  clients: number
  byName: Record<string, { rooms: number; clients: number }>
}

export function summarizeRooms(listings: RoomListingLike[]): RoomOccupancy {
  const byName: Record<string, { rooms: number; clients: number }> = {}
  let clients = 0
  for (const listing of listings) {
    const name =
      typeof listing.name === 'string' && listing.name.length > 0
        ? listing.name
        : 'unknown'
    const n = Number(listing.clients) || 0
    clients += n
    const bucket = byName[name] ?? { rooms: 0, clients: 0 }
    bucket.rooms += 1
    bucket.clients += n
    byName[name] = bucket
  }
  return { count: listings.length, clients, byName }
}
