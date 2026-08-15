import { describe, expect, it } from 'vitest'
import { sessionActorId, sessionHasEmail } from './session-user'

describe('session identity', () => {
  it('prefers user.id and falls back to email so talk cannot bounce to login', () => {
    expect(sessionActorId(null)).toBeNull()
    expect(
      sessionActorId({ user: { email: 'scott@derozic.com' } } as never),
    ).toBe('scott@derozic.com')
    expect(
      sessionActorId({
        user: { id: 'usr_1', email: 'scott@derozic.com' },
      } as never),
    ).toBe('usr_1')
    expect(sessionHasEmail({ user: { email: 'a@b.c' } } as never)).toBe(true)
    expect(sessionHasEmail({ user: { id: 'x' } } as never)).toBe(false)
  })
})
