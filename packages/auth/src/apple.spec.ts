import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  APPLE_NOT_CONFIGURED,
  appleAuthorizeUrl,
  appleCallbackUrl,
  appleClientSecret,
  emailFromAppleClaims,
  isAllowedAppleOrigin,
  isAppleAuthConfigured,
  normalizeAppleReturnTo,
  parseAppleUserName,
  encodeAppleState,
  decodeAppleState,
  mintAppleSessionTicket,
  verifyAppleSessionTicket,
} from './apple'

const saved = { ...process.env }

function pemKey() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
}

describe('apple auth', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'bevel-test-auth-secret-min-32-chars!!'
    delete process.env.APPLE_CLIENT_ID
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_KEY_ID
    delete process.env.APPLE_PRIVATE_KEY
    delete process.env.APPLE_CALLBACK_URL
    delete process.env.APPLE_APP_ID
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it('is unconfigured without the .p8', () => {
    expect(isAppleAuthConfigured()).toBe(false)
  })

  it('is configured when team, key id, services id, and PEM are set', () => {
    process.env.APPLE_CLIENT_ID = 'com.derozic.bevel.web'
    process.env.APPLE_TEAM_ID = '8A36CUVEDS'
    process.env.APPLE_KEY_ID = 'ABCDE12345'
    process.env.APPLE_PRIVATE_KEY = pemKey()
    expect(isAppleAuthConfigured()).toBe(true)
  })

  it('mints an ES256 client-secret JWT', async () => {
    process.env.APPLE_CLIENT_ID = 'com.derozic.bevel.web'
    process.env.APPLE_TEAM_ID = '8A36CUVEDS'
    process.env.APPLE_KEY_ID = 'ABCDE12345'
    process.env.APPLE_PRIVATE_KEY = pemKey()
    const jwt = await appleClientSecret()
    const [, payload] = jwt.split('.')
    const claims = JSON.parse(
      Buffer.from(payload!, 'base64url').toString('utf8'),
    ) as { iss: string; sub: string; aud: string }
    expect(claims.iss).toBe('8A36CUVEDS')
    expect(claims.sub).toBe('com.derozic.bevel.web')
    expect(claims.aud).toBe('https://appleid.apple.com')
  })

  it('builds the authorize URL with form_post', async () => {
    process.env.APPLE_CLIENT_ID = 'com.derozic.bevel.web'
    process.env.APPLE_TEAM_ID = '8A36CUVEDS'
    process.env.APPLE_KEY_ID = 'ABCDE12345'
    process.env.APPLE_PRIVATE_KEY = pemKey()
    const url = new URL(
      await appleAuthorizeUrl('state-1', 'https://bevel.lvh.me'),
    )
    expect(url.origin + url.pathname).toBe(
      'https://appleid.apple.com/auth/authorize',
    )
    expect(url.searchParams.get('client_id')).toBe('com.derozic.bevel.web')
    expect(url.searchParams.get('response_mode')).toBe('form_post')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://bevel.lvh.me/auth/apple/callback',
    )
  })

  it('allowlists bevel hosts and rejects foreign return_to', () => {
    expect(isAllowedAppleOrigin('https://bevel.lvh.me')).toBe(true)
    expect(isAllowedAppleOrigin('https://bevel.is')).toBe(true)
    expect(isAllowedAppleOrigin('http://bevel.lvh.me')).toBe(false)
    expect(isAllowedAppleOrigin('https://evil.example')).toBe(false)
    expect(
      normalizeAppleReturnTo(
        'https://evil.example/phish',
        'https://bevel.lvh.me',
      ),
    ).toBe('/welcome')
    expect(
      normalizeAppleReturnTo('/workspaces', 'https://bevel.lvh.me'),
    ).toBe('/workspaces')
    expect(
      appleCallbackUrl('https://bevel.is'),
    ).toBe('https://bevel.is/auth/apple/callback')
  })

  it('parses the first-authorize name blob', () => {
    expect(
      parseAppleUserName(
        JSON.stringify({ name: { firstName: 'Ada', lastName: 'Lovelace' } }),
      ),
    ).toBe('Ada Lovelace')
    expect(parseAppleUserName('not-json')).toBeNull()
  })

  it('synthesizes a relay email when Apple hides the address', () => {
    expect(emailFromAppleClaims({ sub: '001234.abcdef' })).toBe(
      'apple.001234abcdef@relay.bevel.is',
    )
    expect(
      emailFromAppleClaims({ email: 'scott@derozic.com', sub: 'x' }),
    ).toBe('scott@derozic.com')
  })

  it('round-trips signed state and session tickets', async () => {
    const state = await encodeAppleState({
      returnTo: '/welcome',
      origin: 'https://bevel.lvh.me',
    })
    expect(await decodeAppleState(state)).toEqual({
      returnTo: '/welcome',
      origin: 'https://bevel.lvh.me',
    })
    const ticket = await mintAppleSessionTicket({
      email: 'scott@derozic.com',
      name: 'Scott',
      appleId: 'apple-sub',
    })
    expect(await verifyAppleSessionTicket(ticket)).toEqual({
      email: 'scott@derozic.com',
      name: 'Scott',
      appleId: 'apple-sub',
    })
  })

  it('keeps the unconfigured sentence', () => {
    expect(APPLE_NOT_CONFIGURED).toMatch(/Use Google/)
  })
})
