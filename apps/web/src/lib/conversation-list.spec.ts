import { describe, expect, it } from 'vitest'
import {
  filterVisibleSessions,
  sortSessionsStable,
  syncConversationData,
} from './conversation-list'
import type { SessionSummary } from './realtime'

function session(
  partial: Partial<SessionSummary> & { sessionId: string },
): SessionSummary {
  return {
    title: 'Thread',
    agentIds: ['hermes'],
    messageCount: 1,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('conversation list (workspace rail)', () => {
  it('does not throw when archive rows omit agentIds', () => {
    const incoming = [
      { sessionId: 'dm-1', title: 'Hermes', messageCount: 3 } as SessionSummary,
      { sessionId: 'dm-2', preview: 'hey', messageCount: 0 } as SessionSummary,
      null as unknown as SessionSummary,
    ]
    expect(() => filterVisibleSessions(incoming)).not.toThrow()
    const visible = filterVisibleSessions(incoming)
    expect(visible.map((s) => s.sessionId)).toEqual(['dm-1', 'dm-2'])
    expect(visible[0]!.agentIds).toEqual([])
  })

  it('hides empty sessions with no preview', () => {
    const visible = filterVisibleSessions([
      session({ sessionId: 'empty', messageCount: 0, preview: undefined }),
      session({ sessionId: 'live', messageCount: 2 }),
    ])
    expect(visible.map((s) => s.sessionId)).toEqual(['live'])
  })

  it('keeps existing order when previews refresh', () => {
    const prev = [
      session({ sessionId: 'a', createdAt: 10 }),
      session({ sessionId: 'b', createdAt: 20 }),
    ]
    const incoming = [
      session({ sessionId: 'b', preview: 'new', createdAt: 20 }),
      session({ sessionId: 'a', preview: 'old', createdAt: 10 }),
      session({ sessionId: 'c', createdAt: 30 }),
    ]
    const next = syncConversationData(prev, incoming)
    expect(next.map((s) => s.sessionId)).toEqual(['a', 'b', 'c'])
    expect(next[1]!.preview).toBe('new')
  })

  it('sorts new lists stably by createdAt then id', () => {
    const sorted = sortSessionsStable([
      session({ sessionId: 'z', createdAt: 1 }),
      session({ sessionId: 'a', createdAt: 1 }),
      session({ sessionId: 'm', createdAt: 0 }),
    ])
    expect(sorted.map((s) => s.sessionId)).toEqual(['m', 'a', 'z'])
  })
})
