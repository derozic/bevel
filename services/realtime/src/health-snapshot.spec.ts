import { describe, expect, it } from 'vitest'
import { summarizeRooms } from './health-snapshot'

describe('summarizeRooms', () => {
  it('rolls listings into occupancy without leaking room ids', () => {
    expect(
      summarizeRooms([
        { name: 'fleet_channel', clients: 3 },
        { name: 'fleet_channel', clients: 1 },
        { name: 'agent_session', clients: 2 },
      ]),
    ).toEqual({
      count: 3,
      clients: 6,
      byName: {
        fleet_channel: { rooms: 2, clients: 4 },
        agent_session: { rooms: 1, clients: 2 },
      },
    })
  })
})
