import { describe, expect, it } from 'vitest'
import { summarizeRooms } from './health-snapshot'

describe('summarizeRooms', () => {
  it('rolls listings into occupancy without leaking room ids', () => {
    expect(
      summarizeRooms([
        { name: 'fleet_channel', clients: 3, metadata: { humans: 2, reconnecting: 1 } },
        { name: 'fleet_channel', clients: 1, metadata: { humans: 1, reconnecting: 0 } },
        { name: 'agent_session', clients: 2 },
      ]),
    ).toEqual({
      count: 3,
      clients: 6,
      humans: 3,
      reconnecting: 1,
      byName: {
        fleet_channel: { rooms: 2, clients: 4, humans: 3, reconnecting: 1 },
        agent_session: { rooms: 1, clients: 2, humans: 0, reconnecting: 0 },
      },
    })
  })
})
