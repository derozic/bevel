import { describe, expect, it } from 'vitest'
import { csrfTokenFromCookieValue, csrfTokenFromCookies } from './csrf-cookie'

describe('csrf cookie', () => {
  it('takes the token before the hash', () => {
    expect(csrfTokenFromCookieValue('abc123|deadbeef')).toBe('abc123')
    expect(csrfTokenFromCookieValue('abc123')).toBe('abc123')
    expect(csrfTokenFromCookieValue('')).toBeNull()
  })

  it('prefers Auth.js cookie names used on bevel.is and 2x4m suite hosts', () => {
    const cookies: Record<string, string> = {
      'next-auth.csrf-token': 'suite-token|hash',
    }
    expect(csrfTokenFromCookies((name) => cookies[name])).toBe('suite-token')
    cookies['__Host-authjs.csrf-token'] = 'host-token|hash'
    expect(csrfTokenFromCookies((name) => cookies[name])).toBe('host-token')
  })
})
