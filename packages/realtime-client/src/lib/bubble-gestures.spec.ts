import { describe, expect, it } from 'vitest'
import { resolveSwipeKind, SWIPE_PX } from './bubble-gestures'

describe('mobile bubble swipes', () => {
  it('maps a right swipe to thumbs up and left to thumbs down', () => {
    expect(resolveSwipeKind(SWIPE_PX + 4, 4)).toBe('up')
    expect(resolveSwipeKind(-(SWIPE_PX + 4), 4)).toBe('down')
  })

  it('ignores short flicks and vertical scrolls', () => {
    expect(resolveSwipeKind(20, 0)).toBeNull()
    expect(resolveSwipeKind(80, 90)).toBeNull()
  })
})
