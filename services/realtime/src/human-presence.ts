export const PRESENCE_IDLE_AFTER_MS = 90_000
export const PRESENCE_RECONNECT_SECONDS = 45
export const PRESENCE_TICK_MS = 5_000

export type PresenceStatus = 'here' | 'idle' | 'reconnecting'

export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return value === 'here' || value === 'idle' || value === 'reconnecting'
}

export function coercePresenceStatus(value: unknown): PresenceStatus {
  return isPresenceStatus(value) ? value : 'here'
}

export type PresenceRecord = {
  clientId: string
  userId: string
  name: string
  avatar: string
  status: string
  lastSeenAt: number
  lastInputAt: number
  seats: number
}

export type PresenceList<T extends PresenceRecord> = {
  length: number
  push(item: T): number
  splice(start: number, deleteCount?: number): T[]
  [index: number]: T | undefined
}

type SeatPhase = 'here' | 'reconnecting'

type Seat = {
  sessionId: string
  userId: string
  phase: SeatPhase
  visible: boolean
  lastInputAt: number
}

export type JoinHumanInput = {
  sessionId: string
  userId: string
  name: string
  avatar: string
  now: number
}

export type HeartbeatInput = {
  visible?: boolean
  lastInputAt?: number
  now: number
}

export type Occupancy = {
  humans: number
  reconnecting: number
}

function findRow<T extends PresenceRecord>(
  humans: PresenceList<T>,
  userId: string,
): { index: number; row: T } | null {
  if (!userId) return null
  for (let i = 0; i < humans.length; i++) {
    const row = humans[i]
    if (row?.userId === userId) return { index: i, row }
  }
  return null
}

function rollupStatus(seats: Seat[], now: number): PresenceStatus | null {
  if (seats.length === 0) return null
  const live = seats.filter((s) => s.phase === 'here')
  if (live.some((s) => s.visible && now - s.lastInputAt < PRESENCE_IDLE_AFTER_MS)) {
    return 'here'
  }
  if (live.length > 0) return 'idle'
  if (seats.some((s) => s.phase === 'reconnecting')) return 'reconnecting'
  return null
}

/**
 * One public presence row per signed-in user, with per-tab seats underneath.
 * Used by FleetChannel and AgentSession.
 */
export class HumanPresenceBook<T extends PresenceRecord> {
  private readonly seats = new Map<string, Seat>()

  constructor(
    private readonly humans: PresenceList<T>,
    private readonly createRow: () => T,
  ) {}

  join(input: JoinHumanInput): T {
    const { sessionId, userId, name, avatar, now } = input
    const existing = this.seats.get(sessionId)
    if (existing && existing.userId !== userId) {
      this.leave(sessionId, now)
    }
    this.seats.set(sessionId, {
      sessionId,
      userId,
      phase: 'here',
      visible: true,
      lastInputAt: now,
    })
    return this.writeRow(userId, { name, avatar, clientId: sessionId, now })
  }

  drop(sessionId: string, now: number): T | null {
    const seat = this.seats.get(sessionId)
    if (!seat) return null
    seat.phase = 'reconnecting'
    seat.visible = false
    return this.writeRow(seat.userId, { now })
  }

  reconnect(sessionId: string, now: number): T | null {
    const seat = this.seats.get(sessionId)
    if (!seat) return null
    seat.phase = 'here'
    seat.visible = true
    seat.lastInputAt = now
    return this.writeRow(seat.userId, { clientId: sessionId, now })
  }

  leave(sessionId: string, now: number): T | null {
    const seat = this.seats.get(sessionId)
    if (!seat) return null
    this.seats.delete(sessionId)
    const remaining = this.seatsFor(seat.userId)
    if (remaining.length === 0) {
      const found = findRow(this.humans, seat.userId)
      if (found) this.humans.splice(found.index, 1)
      return null
    }
    return this.writeRow(seat.userId, { now })
  }

  heartbeat(sessionId: string, input: HeartbeatInput): T | null {
    const seat = this.seats.get(sessionId)
    if (!seat || seat.phase !== 'here') return null
    if (typeof input.visible === 'boolean') seat.visible = input.visible
    if (typeof input.lastInputAt === 'number' && Number.isFinite(input.lastInputAt)) {
      seat.lastInputAt = input.lastInputAt
    } else if (input.visible) {
      seat.lastInputAt = input.now
    }
    return this.writeRow(seat.userId, { now: input.now })
  }

  tick(now: number): void {
    const users = new Set([...this.seats.values()].map((s) => s.userId))
    for (const userId of users) this.writeRow(userId, { now })
  }

  occupancy(): Occupancy {
    let reconnecting = 0
    for (let i = 0; i < this.humans.length; i++) {
      if (this.humans[i]?.status === 'reconnecting') reconnecting += 1
    }
    return { humans: this.humans.length, reconnecting }
  }

  private seatsFor(userId: string): Seat[] {
    return [...this.seats.values()].filter((s) => s.userId === userId)
  }

  private writeRow(
    userId: string,
    patch: { name?: string; avatar?: string; clientId?: string; now: number },
  ): T {
    const seats = this.seatsFor(userId)
    const status = rollupStatus(seats, patch.now) ?? 'here'
    const found = findRow(this.humans, userId)
    const row = found?.row ?? this.createRow()
    const latest = seats[seats.length - 1]
    row.userId = userId
    row.clientId = patch.clientId ?? latest?.sessionId ?? row.clientId
    if (patch.name) row.name = patch.name
    if (typeof patch.avatar === 'string') row.avatar = patch.avatar
    row.status = status
    row.lastSeenAt = patch.now
    row.lastInputAt = Math.max(0, ...seats.map((s) => s.lastInputAt))
    row.seats = seats.length
    if (!found) this.humans.push(row)
    return row
  }
}

/** Drop stale connections for the same signed-in user (tabs, HMR, reconnects). */
export function removeHumansByUserId<T extends { userId?: string }>(
  humans: { length: number; splice(start: number, deleteCount?: number): T[] },
  userId: string,
): void {
  if (!userId) return
  for (let i = humans.length - 1; i >= 0; i--) {
    const row = (humans as { [index: number]: T | undefined })[i]
    if (row?.userId === userId) {
      humans.splice(i, 1)
    }
  }
}
