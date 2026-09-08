import { describe, expect, it } from 'vitest'
import {
  channelLampLabel,
  channelLampState,
  coercePresenceStatus,
  isAbnormalClose,
  presenceTooltip,
} from './channel-lamp'

describe('channel lamp', () => {
  it('is live while the socket is up', () => {
    expect(channelLampState({ connected: true, reconnecting: true })).toBe('live')
    expect(channelLampState({ connected: false, reconnecting: true })).toBe(
      'reconnecting',
    )
    expect(channelLampState({ connected: false, reconnecting: false })).toBe('down')
  })

  it('names the lamp for assistive tech', () => {
    expect(channelLampLabel('live')).toBe('Channel live')
    expect(channelLampLabel('reconnecting')).toBe('Reconnecting')
    expect(channelLampLabel('down')).toBe('Channel down')
  })
})

describe('presence helpers', () => {
  it('treats missing status as here', () => {
    expect(coercePresenceStatus(undefined)).toBe('here')
    expect(coercePresenceStatus('idle')).toBe('idle')
  })

  it('flags abnormal socket closes for reconnect, not join-failed copy', () => {
    expect(isAbnormalClose(1006)).toBe(true)
    expect(isAbnormalClose(4002, 'seat reservation expired')).toBe(true)
    expect(isAbnormalClose(1000)).toBe(false)
  })

  it('builds occupancy tooltips without Slack copy', () => {
    expect(presenceTooltip('Scott', 'here')).toBe('Scott · here')
    expect(presenceTooltip('Scott')).toBe('Scott')
  })
})
