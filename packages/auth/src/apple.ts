/**
 * Sign in with Apple via the raw Apple ID REST APIs.
 *
 * We mint the client-secret JWT (ES256) and verify identity tokens against
 * Apple's JWKS. This is not a paid identity product.
 */

import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose'
import { resolveAuthSecret } from './tokens'

export const APPLE_ISS = 'https://appleid.apple.com'
export const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize'
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
export const APPLE_NOT_CONFIGURED =
  'Apple sign-in is not configured on this server yet. Use Google.'

const APPLE_JWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL))

export class AppleAuthError extends Error {
  statusCode: number
  code: string
  constructor(
    message: string,
    statusCode = 400,
    code = 'apple',
  ) {
    super(message)
    this.name = 'AppleAuthError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function applePrivateKeyPem(): string {
  const raw = (process.env.APPLE_PRIVATE_KEY || '').trim()
  if (!raw) return ''
  return raw.replace(/\\n/g, '\n')
}

export function appleClientId(): string {
  return (
    process.env.AUTH_APPLE_ID ||
    process.env.APPLE_CLIENT_ID ||
    ''
  ).trim()
}

export function appleAppId(): string {
  return (process.env.APPLE_APP_ID || '').trim()
}

export function appleTeamId(): string {
  return (process.env.APPLE_TEAM_ID || '').trim()
}

export function appleKeyId(): string {
  return (process.env.APPLE_KEY_ID || '').trim()
}

/** True only when we can mint the ES256 client secret ourselves. */
export function isAppleAuthConfigured(): boolean {
  const key = applePrivateKeyPem()
  return Boolean(
    appleClientId() &&
      appleTeamId() &&
      appleKeyId() &&
      key.includes('BEGIN PRIVATE KEY'),
  )
}

export function appleCallbackUrl(origin?: string): string {
  const fromEnv = (process.env.APPLE_CALLBACK_URL || '').trim()
  const hostOrigin = (origin || '').replace(/\/$/, '')
  if (hostOrigin && isAllowedAppleOrigin(hostOrigin)) {
    return `${hostOrigin}/auth/apple/callback`
  }
  if (fromEnv) return fromEnv
  return 'https://bevel.lvh.me/auth/apple/callback'
}

export function isAllowedAppleOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'bevel.lvh.me' || h.endsWith('.bevel.lvh.me')) return true
    if (h === 'bevel.is' || h === 'www.bevel.is' || h.endsWith('.bevel.is')) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function normalizeAppleReturnTo(
  raw: string | null | undefined,
  origin: string,
): string {
  const fallback = '/welcome'
  const value = (raw || '').trim()
  if (!value) return fallback
  if (value.startsWith('/') && !value.startsWith('//')) return value
  if (value.startsWith('bevel://') || value.startsWith('app://')) return value
  try {
    const u = new URL(value)
    if (isAllowedAppleOrigin(u.origin) || u.origin === origin) {
      return u.toString()
    }
  } catch {
    /* reject */
  }
  return fallback
}

export async function appleClientSecret(now = new Date()): Promise<string> {
  if (!isAppleAuthConfigured()) {
    throw new AppleAuthError(APPLE_NOT_CONFIGURED, 503, 'apple_not_configured')
  }
  const pem = applePrivateKeyPem()
  const key = await importPKCS8(pem, 'ES256')
  const iat = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: appleKeyId() })
    .setIssuer(appleTeamId())
    .setIssuedAt(iat)
    .setExpirationTime(iat + 15 * 60)
    .setAudience(APPLE_ISS)
    .setSubject(appleClientId())
    .sign(key)
}

export async function appleAuthorizeUrl(
  state: string,
  origin?: string,
): Promise<string> {
  if (!isAppleAuthConfigured()) {
    throw new AppleAuthError(APPLE_NOT_CONFIGURED, 503, 'apple_not_configured')
  }
  const params = new URLSearchParams({
    client_id: appleClientId(),
    redirect_uri: appleCallbackUrl(origin),
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  })
  return `${APPLE_AUTH_URL}?${params.toString()}`
}

async function decodeIdentityToken(idToken: string, audience: string) {
  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISS,
      audience,
      algorithms: ['RS256'],
    })
    return payload
  } catch {
    throw new AppleAuthError(
      'Apple could not verify this sign-in. Try again.',
      401,
      'apple_token_invalid',
    )
  }
}

export async function verifyAppleIdentityToken(
  idToken: string,
  audiences?: string[],
) {
  const token = (idToken || '').trim()
  if (!token) {
    throw new AppleAuthError('Apple did not return an identity token.')
  }
  const candidates = (
    audiences?.length
      ? audiences
      : [appleClientId(), appleAppId()]
  )
    .map((v) => v.trim())
    .filter(Boolean)
  let last: AppleAuthError | null = null
  for (const audience of candidates) {
    try {
      return await decodeIdentityToken(token, audience)
    } catch (err) {
      if (err instanceof AppleAuthError) last = err
      else {
        last = new AppleAuthError(
          'Apple could not verify this sign-in. Try again.',
          401,
          'apple_token_invalid',
        )
      }
    }
  }
  if (last) throw last
  throw new AppleAuthError(APPLE_NOT_CONFIGURED, 503, 'apple_not_configured')
}

export async function exchangeAppleCode(
  code: string,
  origin?: string,
): Promise<{ id_token?: string; access_token?: string }> {
  const secret = await appleClientSecret()
  const body = new URLSearchParams({
    client_id: appleClientId(),
    client_secret: secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: appleCallbackUrl(origin),
  })
  const res = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new AppleAuthError(
      'Apple sign-in did not complete. Try again.',
      401,
      'apple_exchange_failed',
    )
  }
  return (await res.json()) as { id_token?: string; access_token?: string }
}

export function parseAppleUserName(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string }
    }
    const name = payload.name || {}
    const joined = [name.firstName, name.lastName]
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .join(' ')
    return joined || null
  } catch {
    return null
  }
}

export function emailFromAppleClaims(claims: {
  sub?: unknown
  email?: unknown
}): string {
  if (typeof claims.email === 'string' && claims.email.includes('@')) {
    return claims.email.trim().toLowerCase()
  }
  const sub = String(claims.sub || '').replace(/[^a-zA-Z0-9]/g, '')
  const tail = (sub.slice(-12) || 'member').toLowerCase()
  return `apple.${tail}@relay.bevel.is`
}

type AppleState = { returnTo: string; origin: string }

function stateSecret(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret())
}

export async function encodeAppleState(state: AppleState): Promise<string> {
  return new SignJWT({
    returnTo: state.returnTo,
    origin: state.origin,
    typ: 'apple_oauth',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(stateSecret())
}

export async function decodeAppleState(state: string | null | undefined): Promise<AppleState | null> {
  const token = (state || '').trim()
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, stateSecret(), {
      algorithms: ['HS256'],
    })
    if (payload.typ !== 'apple_oauth') return null
    const returnTo = typeof payload.returnTo === 'string' ? payload.returnTo : ''
    const origin = typeof payload.origin === 'string' ? payload.origin : ''
    if (!returnTo || !origin) return null
    return { returnTo, origin }
  } catch {
    return null
  }
}

export async function mintAppleSessionTicket(input: {
  email: string
  name?: string | null
  appleId: string
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    name: input.name || '',
    appleId: input.appleId,
    typ: 'apple_ticket',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.email)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(stateSecret())
}

export async function verifyAppleSessionTicket(ticket: string): Promise<{
  email: string
  name: string
  appleId: string
} | null> {
  const token = (ticket || '').trim()
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, stateSecret(), {
      algorithms: ['HS256'],
    })
    if (payload.typ !== 'apple_ticket') return null
    const email = typeof payload.email === 'string' ? payload.email : ''
    const appleId = typeof payload.appleId === 'string' ? payload.appleId : ''
    if (!email || !appleId) return null
    return {
      email,
      name: typeof payload.name === 'string' ? payload.name : '',
      appleId,
    }
  } catch {
    return null
  }
}
