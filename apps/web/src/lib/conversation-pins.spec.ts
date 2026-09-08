import { describe, expect, it } from 'vitest'
import {
  defaultChannelPins,
  hasPin,
  pinKey,
  resolvePins,
  togglePin,
} from './conversation-pins'

describe('conversation pins', () => {
  it('toggles a pin on and off without duplicating', () => {
    const hermes = { kind: 'talk' as const, id: 'Hermes' }
    const once = togglePin([], hermes)
    expect(once).toEqual([{ kind: 'talk', id: 'hermes' }])
    expect(hasPin(once, { kind: 'talk', id: 'hermes' })).toBe(true)
    expect(togglePin(once, hermes)).toEqual([])
  })

  it('uses workspace tracks until the member customizes pins', () => {
    expect(resolvePins(undefined, ['general', 'ops', 'product']).pins).toEqual(
      defaultChannelPins(['general', 'ops', 'product']),
    )
    expect(resolvePins(undefined, ['general', 'ops']).usingDefaults).toBe(true)
    expect(resolvePins([], ['general']).pins).toEqual([])
    expect(resolvePins([], ['general']).usingDefaults).toBe(false)
  })

  it('keys pins by kind so ~hermes and talk:hermes stay distinct', () => {
    expect(pinKey({ kind: 'channel', id: 'hermes' })).toBe('channel:hermes')
    expect(pinKey({ kind: 'talk', id: 'hermes' })).toBe('talk:hermes')
  })
})
