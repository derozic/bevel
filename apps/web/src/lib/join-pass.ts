import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE = 'bevel_join'
const PIN_COOKIE = 'bevel_pin'
const MAX_AGE_SEC = 60 * 60 * 12

export type JoinPass = {
  href: string
  linkId: string
  exp: number
}

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'bevel-dev'
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function sealJoinPass(href: string, linkId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  const body = Buffer.from(JSON.stringify({ href, linkId, exp }), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

export function openJoinPass(token: string | undefined | null): JoinPass | null {
  if (!token || !token.includes('.')) return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = sign(body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JoinPass
    if (!parsed.href?.startsWith('/') || !parsed.linkId || parsed.exp * 1000 < Date.now()) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function readJoinPass(): Promise<JoinPass | null> {
  const jar = await cookies()
  return openJoinPass(jar.get(COOKIE)?.value)
}

export function joinPassCookie(href: string, linkId: string): {
  name: string
  value: string
  options: {
    httpOnly: boolean
    sameSite: 'lax'
    secure: boolean
    path: string
    maxAge: number
  }
} {
  return {
    name: COOKIE,
    value: sealJoinPass(href, linkId),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_SEC,
    },
  }
}

/** True when this guest pass was issued for the page they are opening. */
export function joinPassMatches(pass: JoinPass | null, href: string): boolean {
  if (!pass) return false
  return pass.href === href
}

export function pinOkCookie(token: string) {
  return {
    name: PIN_COOKIE,
    value: sealJoinPass(`/join/${token}`, token),
    options: {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 30,
    },
  }
}

export async function pinWasEntered(token: string): Promise<boolean> {
  const jar = await cookies()
  const pass = openJoinPass(jar.get(PIN_COOKIE)?.value)
  return Boolean(pass && pass.linkId === token)
}
