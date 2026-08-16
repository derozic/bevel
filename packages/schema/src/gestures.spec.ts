import { describe, expect, it } from 'vitest'
import {
  applyGesture,
  formatGestureFeedback,
  gestureCounts,
  parseVotePrompt,
  stripVoteMarker,
} from './gestures'

describe('chat gestures', () => {
  it('toggles the same kind and keeps star independent of thumbs', () => {
    const one = applyGesture([], { kind: 'up', userId: 'u1', userName: 'Scott' })
    expect(one).toHaveLength(1)
    const two = applyGesture(one, { kind: 'star', userId: 'u1' })
    expect(two.map((g) => g.kind).sort()).toEqual(['star', 'up'])
    const off = applyGesture(two, { kind: 'up', userId: 'u1' })
    expect(off.map((g) => g.kind)).toEqual(['star'])
  })

  it('makes thumbs and votes exclusive pairs', () => {
    const up = applyGesture([], { kind: 'up', userId: 'u1' })
    const down = applyGesture(up, { kind: 'down', userId: 'u1' })
    expect(down.map((g) => g.kind)).toEqual(['down'])
    const yes = applyGesture(down, { kind: 'vote_yes', userId: 'u1' })
    const no = applyGesture(yes, { kind: 'vote_no', userId: 'u1' })
    expect(no.map((g) => g.kind).sort()).toEqual(['down', 'vote_no'])
  })

  it('parses vote markers and strips them from display', () => {
    expect(parseVotePrompt('[vote: Ship pricing?] Details below')).toBe(
      'Ship pricing?',
    )
    expect(stripVoteMarker('[vote: Ship pricing?] Details below')).toBe(
      'Details below',
    )
    expect(parseVotePrompt('hello', { voteRequired: true })).toBe('Vote on this')
  })

  it('summarizes signals for the next agent turn', () => {
    const gestures = [
      ...applyGesture([], { kind: 'up', userId: 'a' }),
      ...applyGesture([], { kind: 'down', userId: 'b' }),
    ]
    const text = formatGestureFeedback(gestures)
    expect(text).toContain('thumbs up')
    expect(text).toContain('thumbs down')
    expect(gestureCounts(gestures).up).toBe(1)
  })
})
