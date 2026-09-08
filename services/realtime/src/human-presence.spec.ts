import { describe, expect, it } from 'vitest'
import {
  HumanPresenceBook,
  PRESENCE_IDLE_AFTER_MS,
  coercePresenceStatus,
  type PresenceRecord,
} from './human-presence'

class FakeHumans {
  items: PresenceRecord[] = []
  get length() {
    return this.items.length
  }
  push(item: PresenceRecord) {
    this.items.push(item)
    return this.items.length
  }
  splice(start: number, deleteCount = 1) {
    return this.items.splice(start, deleteCount)
  }
}

function recordAt(list: FakeHumans, index: number): PresenceRecord {
  const row = list.items[index]
  if (!row) throw new Error(`missing row ${index}`)
  return row
}

function book() {
  const humans = new FakeHumans() as FakeHumans & { [index: number]: PresenceRecord }
  Object.defineProperty(humans, '0', { get: () => humans.items[0], configurable: true })
  const proxy = new Proxy(humans, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return target.items[Number(prop)]
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as unknown as FakeHumans & PresenceRecord[] & { length: number; push: FakeHumans['push']; splice: FakeHumans['splice'] }
  const presence = new HumanPresenceBook(proxy as never, () => ({
    clientId: '',
    userId: '',
    name: '',
    avatar: '',
    status: 'here',
    lastSeenAt: 0,
    lastInputAt: 0,
    seats: 0,
  }))
  return { humans: proxy, presence }
}

describe('HumanPresenceBook', () => {
  it('upserts one row per user and counts seats', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: 's.jpg',
      now: 1,
    })
    presence.join({
      sessionId: 'b',
      userId: 'scott',
      name: 'Scott',
      avatar: 's.jpg',
      now: 2,
    })
    expect(humans.length).toBe(1)
    expect(recordAt(humans as unknown as FakeHumans, 0).seats).toBe(2)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('here')
  })

  it('marks reconnecting on drop and restores on reconnect', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 1,
    })
    presence.drop('a', 2)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('reconnecting')
    presence.reconnect('a', 3)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('here')
  })

  it('keeps the row here when a second tab is still seated', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 1,
    })
    presence.join({
      sessionId: 'b',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 2,
    })
    presence.drop('a', 3)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('here')
    expect(recordAt(humans as unknown as FakeHumans, 0).seats).toBe(2)
  })

  it('splices the row on the last leave', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 1,
    })
    presence.leave('a', 2)
    expect(humans.length).toBe(0)
  })

  it('rolls here to idle after the quiet threshold', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 1_000,
    })
    presence.heartbeat('a', { visible: false, now: 1_000 })
    presence.tick(1_000 + PRESENCE_IDLE_AFTER_MS + 1)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('idle')
  })

  it('does not mark idle while reconnecting', () => {
    const { humans, presence } = book()
    presence.join({
      sessionId: 'a',
      userId: 'scott',
      name: 'Scott',
      avatar: '',
      now: 1,
    })
    presence.drop('a', 2)
    presence.tick(2 + PRESENCE_IDLE_AFTER_MS * 2)
    expect(recordAt(humans as unknown as FakeHumans, 0).status).toBe('reconnecting')
  })
})

describe('coercePresenceStatus', () => {
  it('treats missing schema fields as here', () => {
    expect(coercePresenceStatus(undefined)).toBe('here')
    expect(coercePresenceStatus('idle')).toBe('idle')
    expect(coercePresenceStatus('nope')).toBe('here')
  })
})
