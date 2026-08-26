import { describe, expect, it } from 'vitest'
import { publicOriginFromRequest } from './public-origin'

describe('publicOriginFromRequest', () => {
  it('prefers forwarded host over the bind address', () => {
    const origin = publicOriginFromRequest({
      url: 'http://localhost:41009/api/auth/handoff?code=abc',
      headers: new Headers({
        host: 'localhost:41009',
        'x-forwarded-host': 'bevel.2ndbra.in',
        'x-forwarded-proto': 'https',
      }),
    })
    expect(origin).toBe('https://bevel.2ndbra.in')
  })

  it('does not return localhost even when that is the only request URL', () => {
    const origin = publicOriginFromRequest({
      url: 'https://localhost:41009/api/auth/handoff',
      headers: new Headers({ host: 'localhost:41009' }),
    })
    expect(origin).not.toMatch(/localhost/)
    expect(origin.startsWith('https://')).toBe(true)
  })
})
