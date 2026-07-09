import type { ChatMsg, HumanParticipant } from './colyseus-messages'

export type RoomSnapshot = {
  messages: ChatMsg[]
  participants: HumanParticipant[]
  sessionTitle: string | null
  sessionId: string | null
  agentIds: string[]
}

const snapshots = new Map<string, RoomSnapshot>()

export function readRoomSnapshot(roomKey: string): RoomSnapshot | null {
  return snapshots.get(roomKey) ?? null
}

export function writeRoomSnapshot(roomKey: string, snapshot: RoomSnapshot): void {
  snapshots.set(roomKey, snapshot)
}