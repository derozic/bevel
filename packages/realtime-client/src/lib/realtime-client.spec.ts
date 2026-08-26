import { describe, expect, it } from 'vitest'
import { pinRealtimeEndpoint } from './realtime-client'

const BASE = 'https://realtime.bevel.lvh.me'

describe('pinRealtimeEndpoint', () => {
  it('keeps matchmake on https so fetch can POST', () => {
    const url = new URL('https://127.0.0.1:43208/matchmake/joinOrCreate/fleet_channel')
    expect(pinRealtimeEndpoint(BASE, url)).toBe(
      'https://realtime.bevel.lvh.me/matchmake/joinOrCreate/fleet_channel',
    )
  })

  it('pins the seat WebSocket to the Caddy host', () => {
    const url = new URL('ws://127.0.0.1:43208/abc/room1?sessionId=s')
    expect(pinRealtimeEndpoint(BASE, url)).toBe(
      'wss://realtime.bevel.lvh.me/abc/room1?sessionId=s',
    )
  })
})
